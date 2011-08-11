This directory contains all the operational transform code. Each file defines a type.

Most of the types in here are for testing or demonstration.


All OT types have the following fields:

`name`: _(string)_ Name of the type.
`create() -> snapshot`: Function which creates and returns a new document snapshot

`apply(snapshot, op) -> snapshot`: A function which creates a new document snapshot with the op applied
`transform(op1, op2, side) -> op1'`: OT transform function.

Given op1, op2, `apply(s, op2, transform(op1, op2, 'left')) == apply(s, op1, transform(op2, op1, 'right'))`.

Transform and apply must never modify their arguments.


Optional methods:

`tp2`: _(bool)_ True if the transform function supports TP2. This allows p2p architectures to work.
`compose(op1, op2) -> op`: Create and return a new op which has the same effect as op1 + op2.
`serialize(snapshot) -> JSON object`: Serialize a document to something we can JSON.stringify()
`deserialize(object) -> snapshot`: Deserialize a JSON object into the document's internal snapshot format
`prune(op1', op2, side) -> op1`: Inserse transform function. Only required for TP2 types.
`normalize(op) -> op`: Fix up an op to make it valid. Eg, remove skips of size zero.


`count` and `simple` are two trivial OT type definitions if you want to take a look. JSON defines
the ot-for-JSON type (see the wiki for documentation) and all the text types define different text
implementations. (I still have no idea which one I like the most, and they're fun to write!)
