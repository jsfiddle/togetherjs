$(function () {
  $('.embed-submit-button').click(function() {
    // FIXME: uncaught exception: [CannotFind #video-id-input(:nth-child(1)): container only has 0 elements in #video-id-input]
    // I am not sure where this exception is generated. Maybe it is caused by togetherJS?
    var newVideoId = $('#video-id-input').val();
    var newSrc = '//www.youtube.com/embed/' + newVideoId;
    var youTubeIframe = $('iframe')[0];
    $(youTubeIframe).attr("src", newSrc);
    console.log("gonna run reinitailize now...");
    //reinitialize to configure youtube players again
    TogetherJS.reinitialize();
  });
  $('video-id-input').keypress(function(event) {
    if (event.keyCode == 13)
      $('.embed-submit-button').click();
  });
});
