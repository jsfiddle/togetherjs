sys = require 'sys'
createServer = require('./index')

server = createServer()
server.listen 8000
sys.puts 'Server running at http://127.0.0.1:8000/'

