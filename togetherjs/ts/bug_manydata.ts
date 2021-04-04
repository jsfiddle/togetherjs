interface Packet {
    type: string;
    /** strings that uniquely describe the whole string of packets that will be assembled into a message */
    key: string;
    /** index of the part of the message, starts at 0, ends at length - 1 */
    index: number;
    length: number;
    payload: string;
}

type SerializedArguments = { type: string, content: string };

function hashCode(s: string) {
    var hash = 0, i, chr;
    if(s.length === 0) return hash;
    for(i = 0; i < s.length; i++) {
        chr = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

class PacketAssembler {
    private uid = 0;
    private packets = new Map<string, Packet[]>();

    private getNewUid(): number {
        return this.uid++;
    }

    public storeReceivedPacket(p: Packet): SerializedArguments | null {
        let packetList = this.packets.get(p.key);
        if(!packetList) {
            packetList = [];
            this.packets.set(p.key, packetList);
        }

        // For now we try to reorder the packets during assembling, we throw an error if this is not possible
        /*
        if(packetList.length !== 0) {
            const lastPacket = packetList[packetList.length - 1];
            if(p.index !== lastPacket.index + 1) {
                throw console.error("Out of order packet:", lastPacket.index, "and then", p.index, lastPacket, p);
            }
        }
        else {
            if(p.index !== 0) {
                throw console.error("First packet has not index 0:", p.index, p);
            }
        }
        */

        packetList.push(p);
        //console.log("packet received, stored in", packetList);

        if(p.index === (p.length - 1)) {
            this.packets.delete(p.key);
            packetList.sort((a, b) => a.index - b.index);
            const msg = PacketAssembler.assemble(packetList);
            //console.log("Message finished, assembled as", msg);
            return msg;
        }

        return null; // message is not finished
    }

    private static assemble(packets: Packet[]): SerializedArguments | null {
        let assemblage = "";
        let previousIndex: number | null = null;
        for(const p of packets) {
            if(previousIndex !== null && previousIndex + 1 !== p.index) {
                throw console.error("Missing packet:", p.index, p);
            }
            assemblage += p.payload;
            previousIndex = p.index;
        }
        return JSON.parse(assemblage) as SerializedArguments;
    }

    public send(msg: SerializedArguments) {
        //console.log("Sending", msg.type, msg);
        const jsonString = JSON.stringify(msg);
        const parts: string[] = [];
        const coef = 10000;
        let partNumber = 0;

        while(partNumber * coef < jsonString.length) {
            const part = jsonString.substring(partNumber * coef, (partNumber + 1) * coef);
            parts.push(part);
            partNumber++;
        }

        const uid = this.getNewUid();
        let author = { id: "-1", status: "live" };
        if(!author) { // TODO this is trying to track a bug
            console.error("author cannot be obtain from tjs", author);
            author = { id: "-1", status: "live" };
        }
        let packetNumber = 0;
        for(const part of parts) {
            const packet: Packet = {
                type: msg.type,
                key: author.id + "_" + uid.toString() + "_" + msg.type,
                index: packetNumber,
                length: partNumber,
                payload: part,
            }

            // TODO find why the 9th message is sent multiple time at startup when not using a setTimeout
            //setTimeout(() => {
            //console.log("sending packet", packet.index, "len", part.length, packet);
            TogetherJS.send(packet);
            //}, 50 * (packetNumber + 1));
            packetNumber++;
        }
    }
}

const assembler = new PacketAssembler();

function startTjs() {
    TogetherJS.start();
}

function startListening() {
    //TogetherJS.on("app.manydata", (msg) => { console.log("app.manydata received", msg); });
    //TogetherJS.on("togetherjs.manydata", (msg) => { console.log("togetherjs.manydata received", msg); });
    //TogetherJS.on("manydata", (msg) => { console.log("manydata received", msg); });
    //TogetherJS.hub.on("app.manydata", (msg) => { console.log("hub app.manydata received", msg); });
    //TogetherJS.hub.on("togetherjs.manydata", (msg) => { console.log("hub togetherjs.manydata received", msg); });
    TogetherJS.hub.on("manydata" as keyof TogetherJSNS.AnyMessage.MapForReceiving, (msg: any) => {
        const msg2 = msg as any;
        console.log("hub manydata received", msg2.payload.length);
        const maybeMessage = assembler.storeReceivedPacket(msg2);
        if(maybeMessage != null) {
            console.log("message finished", maybeMessage.content.length, hashCode(maybeMessage.content));
        }
        else {
            console.log("message not finished");
        }
    });
}

function sendManyData() {
    var content = "";
    for(var i = 0; i < 1000000; i++) {
        content += Math.random().toString();
    }
    console.log("content length", content.length, "hash", hashCode(content));
    assembler.send({ type: "manydata", content: content });
}