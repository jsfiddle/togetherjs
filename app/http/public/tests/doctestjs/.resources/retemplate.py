#!/usr/bin/env python
import re

section_re = re.compile(r'''
(?P<front1><!--\s*)
  (?P<name>[A-Z_]+)
(?P<front2>\s*-->)
  (?P<value>[^\000]*)
(?P<back1><!--\s*)
  /(?P=name)
(?P<back2>\s*-->)
''', re.VERBOSE | re.MULTILINE)

value_sub_re = re.compile(r'(?P<front><[^>]*")(?:__)(?P<name>[A-Z_]+)(?:__)(?P<back>"[^>]*>)')

title_sub_re = re.compile(r'<title>(.*?)</title>', re.I)


def get_variables(content, value_matches):
    vars = {}
    for match in section_re.finditer(content):
        vars[match.group('name')] = match.group('value')
    for name, value_match_start, value_match_end in value_matches:
        regex = re.escape(value_match_start) + '([^"]*)' + re.escape(value_match_end)
        regex = re.compile(regex)
        for match in regex.finditer(content):
            vars[name] = match.group(1)
    match = title_sub_re.search(content)
    if match:
        vars['PAGE_TITLE'] = match.group(1)
    else:
        print 'No <title> found'
    return vars


def get_value_matches(template):
    matches = []
    for match in value_sub_re.finditer(template):
        matches.append((
                match.group('name'),
                match.group('front'),
                match.group('back')))
    return matches


def sub_template(template, content):
    matches = get_value_matches(template)
    content_vars = get_variables(content, matches)

    def sub_section(match):
        if match.group('name') not in content_vars:
            # Failure, needs to be fixed
            raise Exception('Must have section <!-- %s -->' % match.group('name'))
        return (
            match.group('front1') + match.group('name') + match.group('front2')
            + content_vars.get(match.group('name'), '')
            + match.group('back1') + '/' + match.group('name') + match.group('back2')
            )

    new_content = section_re.sub(sub_section, template)

    def sub_variable(match):
        if match.group('name') not in content_vars:
            print 'Missing tag: __%s__' % match.group('name')
            return '<!-- ' + match.group(0) + ' -->'
        return (
            match.group('front')
            + content_vars[match.group('name')]
            + match.group('back'))

    new_content = value_sub_re.sub(sub_variable, new_content)

    def sub_title(match):
        if 'PAGE_TITLE' in content_vars:
            return '<title>' + content_vars['PAGE_TITLE'] + '</title>'
        else:
            return match.group(0)

    new_content = title_sub_re.sub(sub_title, new_content)

    return new_content


def rewrite_page(page_name, template_name):
    with open(template_name) as fp:
        template = fp.read()
    with open(page_name) as fp:
        content = fp.read()
    try:
        new_content = sub_template(template, content)
    except:
        print 'Error in page:', page_name
        raise
    with open(page_name, 'w') as fp:
        fp.write(new_content)

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 3:
        print 'Usage: retemplate.py TEMPLATE_FILE CONTENT_FILE [...CONTENT_FILE2...]'
        sys.exit(2)
    template_name = sys.argv[1]
    for filename in sys.argv[2:]:
        rewrite_page(filename, template_name)
