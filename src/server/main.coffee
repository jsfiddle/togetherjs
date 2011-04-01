sys = require 'sys'
sharejs = require './index'

connect = require 'connect'

server = connect(connect.logger())
sharejs.attach(server)

server.listen 8000
sys.puts 'Server running at http://127.0.0.1:8000/'

