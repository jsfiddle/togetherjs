$(window).bind("editorloaded", function() {
  var MY_URL = $('<a href="."></a>')[0].href
  var BASE_URL = "http://wpm.toolness.org";
  var dlg = $("#publish-dialog");

  function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == variable) {
        return unescape(pair[1]);
      }
    }
  }

  if (getQueryVariable('p')) {
    editor.setValue('');
    jQuery.ajax({
      type: 'GET',
      url: BASE_URL + getQueryVariable('p'),
      crossDomain: true,
      dataType: 'text',
      error: function() {
        alert('Sorry, an error occurred while trying to get the page. :(');
      },
      success: function(data) {
        editor.setValue(data);
      }
    });
  }

  $(".close", dlg).click(function() {
    dlg.hide();
    return false;
  });
  $("#publish").click(function() {
    dlg.show();
    $(".done", dlg).hide();
    $.ajax({
      type: 'POST',
      url: BASE_URL + '/api/page',
      crossDomain: true,
      data: editor.getValue(),
      error: function() {
        alert("Sorry, an error occurred while trying to publish. :(");
        dlg.hide();
      },
      success: function(data) {
        var viewURL = BASE_URL + data;
        var remixURL = MY_URL + '?p=' + escape(data);
        $(".done", dlg).fadeIn();
        $('a.view', dlg).attr('href', viewURL).text(viewURL);
        $('a.remix', dlg).attr('href', remixURL).text(remixURL);
      },
      dataType: 'text'
    });
  });
});
