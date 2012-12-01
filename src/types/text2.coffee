# This implementation of the text type is the one used by the C ShareDB server.
#
# It is similar to text-composable, however its non-invertable.
#
# Ops are lists of components which iterate over the whole document.
# Components are either:
#   A number N: Skip N characters in the original document
#   "str"     : Insert "str" at the current position in the document
#   {d:'str'} : Delete 'str', which appears at the current position in the document
#
# Eg: [3, 'hi', 5, {d:8}]
#
# Snapshots are strings.

text2 = {}

text2.name = 'text2'

text2.create = -> ''

# -------- Utility methods

checkOp = (op) ->
  throw new Error('Op must be an array of components') unless Array.isArray(op)
  last = null
  for c in op
    switch typeof c
      when 'object'
        throw new Error 'Object components must be deletes of size > 0' unless typeof c.d is 'number' and c.d > 0
      when 'string'
        throw new Error 'Inserts cannot be empty' unless c.length > 0
      when 'number'
        throw new Error 'Skip components must be >0' unless c > 0
        throw new Error 'Adjacent skip components should be combined' if typeof last  == 'number'

    last = c

  throw new Error 'Op has a trailing skip' if typeof last is 'number'

# Makes a function for appending components to a given op.
# Exported for the randomOpGenerator.
makeAppend = (op) -> (component) ->
  if !component || component.d == 0
    return
  else if op.length is 0
    op.push component
  else if typeof component is typeof op[op.length - 1]
    if typeof component is 'object'
      op[op.length - 1].d += component.d
    else
      op[op.length - 1] += component
  else
    op.push component
  
# Makes 2 functions for taking components from the start of an op, and for peeking
# at the next op that could be taken.
makeTake = (op) ->
  # The index of the next component to take
  idx = 0
  # The offset into the component
  offset = 0

  # Take up to length n from the front of op. If n is -1, take the entire next
  # op component. If indivisableField == 'd', delete components won't be separated.
  # If indivisableField == 'i', insert components won't be separated.
  take = (n, indivisableField) ->
    if idx == op.length
      return if n == -1 then null else n

    c = op[idx]
    if typeof c is 'number'
      # Skip
      if n is -1 or c - offset <= n
        part = c - offset
        ++idx; offset = 0
        part
      else
        offset += n
        n
    else if typeof c is 'string'
      # Insert
      if n is -1 or indivisableField is 'i' or c.length - offset <= n
        part = c[offset..]
        ++idx; offset = 0
        part
      else
        part = c[offset...(offset + n)]
        offset += n
        part
    else
      # Delete
      if n is -1 or indivisableField is 'd' or c.d - offset <= n
        part = {d:c.d - offset}
        ++idx; offset = 0
        part
      else
        offset += n
        {d:n}
  
  peekType = () ->
    op[idx]
  
  [take, peekType]

# Find and return the length of an op component
componentLength = (c) ->
  if typeof c is 'number' then c else c.length or c.d

# Remove trailing skips
trim = (op) ->
  op.pop() if op.length > 0 and typeof op[op.length - 1] is 'number'
  op

# Normalize an op, removing all empty skips and empty inserts / deletes. Concatenate
# adjacent inserts and deletes.
text2.normalize = (op) ->
  newOp = []
  append = makeAppend newOp
  append component for component in op

  trim newOp

# Apply the op to the string. Returns the new string.
text2.apply = (str, op) ->
  throw new Error('Snapshot should be a string') unless typeof(str) == 'string'
  checkOp op

  pos = 0
  newDoc = []

  for component in op
    switch typeof component
      when 'number'
        throw new Error 'The op is too long for this document' if component > str.length
        newDoc.push str[...component]
        str = str[component..]
      when 'string'
        newDoc.push component
      when 'object'
        str = str[component.d..]

  newDoc.join('') + str

# transform op1 by op2. Return transformed version of op1.
# op1 and op2 are unchanged by transform.
text2.transform = (op, otherOp, side) ->
  throw new Error "side (#{side}) must be 'left' or 'right'" unless side in ['left', 'right']

  checkOp op
  checkOp otherOp
  newOp = []

  append = makeAppend newOp
  [take, peek] = makeTake op

  for component in otherOp
    switch typeof component
      when 'number' # Skip
        length = component
        while length > 0
          chunk = take length, 'i'
          append chunk
          length -= componentLength chunk unless typeof chunk is 'string'
      when 'string' # Insert
        if side == 'left'
          # The left insert should go first.
          o = peek()
          append take -1 if typeof o is 'string'

        # Otherwise, skip the inserted text.
        append component.length
      when 'object' # Delete.
        length = component.d
        while length > 0
          chunk = take length, 'i'

          switch typeof chunk
            when 'number' then length -= chunk
            when 'string' then append chunk
              # The delete is unnecessary now.
            when 'object' then length -= chunk.d
  
  # Append extras from op1
  while (component = take -1)
    append component

  trim newOp


# Compose 2 ops into 1 op.
text2.compose = (op1, op2) ->
  checkOp op1
  checkOp op2

  result = []

  append = makeAppend result
  [take, _] = makeTake op1

  for component in op2
    switch typeof component
      when 'number' # Skip
        length = component
        while length > 0
          chunk = take(length, 'd')

          append chunk
          length -= componentLength chunk unless typeof chunk is 'object'

      when 'string' # Insert
        append component

      when 'object' # Delete
        length = component.d

        while length > 0
          chunk = take length, 'd'

          switch typeof chunk
            when 'number'
              append {d:chunk}
              length -= chunk
            when 'string'
              length -= chunk.length
            when 'object'
              append chunk
    
  # Append extras from op1
  while (component = take -1)
    append component

  trim result
  
if WEB?
  exports.types.text2 = text2
else
  module.exports = text2

