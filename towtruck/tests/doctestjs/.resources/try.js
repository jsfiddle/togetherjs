window.addEventListener('load', function () {
  var innerHTML = $('#display').html();
  if (localStorage.editText) {
    $('#editor').val(localStorage.editText);
  }
  $('#editor').change(function () {
    localStorage.editText = $('#editor').val();
  });
  $('#testit').click(function () {
    $('#display').html(innerHTML);
    $('#editit').click(function () {
      $('#edit').show();
      $('#display').hide();
      $('#editor').focus();
      $('#doctest-output').hide();
    });
    $('#test-location').addClass('test').text($('#editor').val());
    console.log($('#test-location').text());
    var runner = new doctest.Runner();
    var parser = new doctest.HTMLParser(runner, $('#display')[0], 'pre#test-location');
    runner.init();
    parser.parse();
    runner.run();
  });
}, false);
