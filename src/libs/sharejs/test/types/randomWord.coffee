fs = require 'fs'

# Generate a random int 0 <= k < n
{randomInt} = require '../helpers'

# Return a random word from a corpus each time the method is called
module.exports = do ->
  words = fs.readFileSync(__dirname + '/jabberwocky.txt').toString().split(/\W+/)
  -> words[randomInt(words.length)]


