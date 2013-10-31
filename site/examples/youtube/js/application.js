$(function () {
  $('.embed-submit-button').click(function() {
    var newVideoId = $('input#youtube-embed').val();
    var newEmbedLink = '<iframe width="560" height="315" src="//www.youtube.com/embed/' + newVideoId + '" frameborder="0" allowfullscreen>'
    console.log(newVideoId);
    $('iframe').replaceWith(newEmbedLink);
    TogetherJS.reinitialize();
  });
  $('input#youtube-embed').keypress(function(event) {
    if (event.keyCode == 13)
      $('.embed-submit-button').click();
  });
});
