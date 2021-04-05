export function RandomStream(seed?: number) {
    if(!seed) {
        seed = Date.now();
    }
    if((!seed) || isNaN(seed)) {
        throw new Error("Bad seed");
    }
    let x = (seed % 30268) + 1;
    seed = (seed - (seed % 30268)) / 30268;
    let y = (seed % 30306) + 1;
    seed = (seed - (seed % 30306)) / 30306;
    let z = (seed % 30322) + 1;
    seed = (seed - (seed % 30322)) / 30322;
    return function random() {
        x = (171 * x) % 30269;
        y = (172 * y) % 30307;
        z = (170 * z) % 30323;
        if("logState" in random) {
            console.log('x', x, 'y', y, 'z', z);
        }
        return (x / 30269.0 + y / 30307.0 + z / 30323.0) % 1.0;
    };
}