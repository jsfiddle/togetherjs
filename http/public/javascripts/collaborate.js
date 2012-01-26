$(function(){
  var resizeHandler = function(){
    $("#etherpad").height($(window).height() - 180);
  };
  $(window).resize(resizeHandler);
  resizeHandler();
  
  $('.share-url').click(function(){
    return false;
  });
  $('input.share').click(function(){
    $(this).focus().select();
  });
  
  $('li.FileTab a').click(function(){
    $('#file_tab_nav li.FileTab').removeClass('active');
    $(this).parent().addClass('active');
  });
});
