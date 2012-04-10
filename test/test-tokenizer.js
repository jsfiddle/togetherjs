module("Tokenizer");

test("simple text is tokenized", function() {
  var t = new Slowparse.Tokenizer('hi');
  
  equal(t.position(), 0);
  deepEqual(t.next(), {
    style: null,
    string: 'hi',
    position: 0
  });
  equal(t.position(), 2);
});

test("simple tags are tokenized", function() {
  var t = new Slowparse.Tokenizer('<p>');
  
  equal(t.position(), 0);
  deepEqual(t.next(), {
    style: 'tag',
    string: '<p',
    position: 0
  });
  equal(t.position(), 2);
  deepEqual(t.next(), {
    style: 'tag',
    string: '>',
    position: 2
  });
});

function getAllTokens(html) {
  var tokenizer = new Slowparse.Tokenizer(html);
  var tokens = [];
  while (1) {
    var token = tokenizer.next();
    if (token)
      tokens.push(token);
    else
      return tokens;
  }
}

test("<p>hi</p> is tokenized", function() {
  deepEqual(getAllTokens('<p>hi</p>'), [
    {
      "position": 0,
      "string": "<p",
      "style": "tag"
    },
    {
      "position": 2,
      "string": ">",
      "style": "tag"
    },
    {
      "position": 3,
      "string": "hi",
      "style": null
    },
    {
      "position": 5,
      "string": "</p",
      "style": "tag"
    },
    {
      "position": 8,
      "string": ">",
      "style": "tag"
    }
  ]);
});
