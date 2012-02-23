#!/usr/bin/env ruby

require 'rubygems'
require 'bundler/setup'

# require 'tempfile'
require 'less'

def usage(reason = nil)
  puts "\nThe supplied path doesn't look like a bootstrap project.\n\n" if reason == :bad_path

  puts "Usage:"
  puts "\t#{$0} <path to bootstrap project clone>"
  puts "\t(See https://github.com/twitter/bootstrap/ for repo)"
  exit(0)
end

usage unless ARGV.size == 1

BOOTSTRAP = File.expand_path(ARGV[0])

usage(:bad_path) unless File.exist?("#{BOOTSTRAP}/Makefile")

File.open("#{BOOTSTRAP}/Makefile") do |f|
  if f.read(9) != 'BOOTSTRAP'
    usage(:bad_path)
  end
end

APP_ROOT = File.expand_path(File.dirname(__FILE__) + '/../')


def read_contents(*libs)
  libs = [libs].flatten
  libs.map{|lib| File.read("#{BOOTSTRAP}/less/#{lib.to_s}.less")}
end

less_content = []
less_content << read_contents(:variables, :modals, :mixins)
less_content << ".tow-truck {"


less_content << read_contents(
  :reset,
  :scaffolding,
  :type,
  :forms,
  :tables,
  :sprites,
  :dropdowns,
  :wells,
  #   'component-animations',
  :navs,
  :navbar,
  :breadcrumbs,
  :pagination,
  :pager,
  :close,
  :tooltip,
  :popovers,
  :buttons,
  'button-groups',
  :alerts,
  :thumbnails,
  :labels,
  # 'progress-bars',
  :accordion,
  :carousel,
  :utilities)

less_content << File.read("#{APP_ROOT}/http/public/stylesheets/bookmarklet.less")

less_content << '}'

parser = Less::Parser.new
tree = parser.parse(less_content.flatten.join("\n"))

output_path = "#{APP_ROOT}/http/public/stylesheets/bookmarklet.css"
File.open(output_path, 'w') do |f|
  f.write(tree.to_css)
end

puts "Wrote to #{output_path}"
