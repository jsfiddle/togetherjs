#!/usr/bin/env ruby

require 'rubygems'
require 'bundler/setup'

# require 'tempfile'
require 'less'

APP_ROOT = File.expand_path(File.dirname(__FILE__) + '/../')




def read_contents(*libs)
  libs = [libs].flatten

  libs.map{|lib| File.read("#{APP_ROOT}/http/public/bootstrap/lib/#{lib.to_s}.less")}
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
