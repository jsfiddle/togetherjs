sys = require 'sys'
server = require('./frontend').server

server.listen(8000)
sys.puts 'Server running at http://127.0.0.1:8000/'

require('./socket').install()
