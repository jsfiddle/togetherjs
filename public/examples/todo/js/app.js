$('#add').click( function() {
  var Description = $('#description').val();
  if (! $("#description").val()) {
    $('#alert').html("<strong>Oops!</strong> Please enter an item above.");
    $('#alert').fadeIn().delay(1000).fadeOut();
    return false;
  }
  var id = "item-" + Date.now();
  $('#description').val("").change();
  addItem(Description, id);
  save();
  if (TogetherJS.running) {
    TogetherJS.send({type: "new-item", description: Description, id: id});
  }
  return false;
});

$("#description").on("keyup", function (event) {
  if (event.which == 13) {
    $("#add").click();
  }
});

function addItem(description, id) {
  var existing = $("#" + id);
  if (existing.length) {
    // Already exists...
    existing.closest("li").find(".description").text(description);
    return;
  }
  var li = $('<li class="list-group-item"><input type="checkbox"> <span class="description"></span></li>');
  li.find("input").attr("id", id);
  li.find(".description").text(description);
  $("#todos").append(li);
}

TogetherJS.hub.on("new-item", function (msg) {
  addItem(msg.description, msg.id);
  save();
});

TogetherJS.hub.on("init-items", function (msg) {
  $("#todos").empty();
  msg.items.forEach(function (item) {
    addItem(item.description, item.id);
  });
  save();
});

TogetherJS.hub.on("togetherjs.hello togetherjs.hello-back", function () {
  TogetherJS.send({type: "init-items", items: getItems()});
});

function getItems() {
  var result = [];
  $("#todos li.list-group-item").each(function () {
    var $this = $(this);
    result.push({
      id: $this.find("input").attr("id"),
      description: $this.find(".description").text()
    });
  });
  return result;
}

if (localStorage.getItem('todos')) {
  JSON.parse(localStorage.getItem('todos')).forEach(function (item) {
    addItem(item.description, item.id);
  });
}

function save() {
  localStorage.setItem('todos', JSON.stringify(getItems()));
}

$('#clear').click(function() {
  $("#todos").empty();
  save();
  if (TogetherJS.running) {
    TogetherJS.send({type: "init-items", items: []});
  }
  return false;
});
