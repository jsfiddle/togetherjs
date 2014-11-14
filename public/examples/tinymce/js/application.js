$(function () {
  tinymce.init({ 
    selector: '.tinymce'
  });

  $('.tjsbutton').click(function () {
    $('#togetherjs-dock').toggle();
  });
});
