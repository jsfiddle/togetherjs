// test basic blog template

test('blog', 1, function() {
  var template = '<h1>{blog.title}</h1>\n{if posts}\n<section id="posts">\n{for post in posts}\n  <article>\n    <header>\n      <h1>{post.title}</h1>\n      <p class="by">{post.author}</p>\n    </header>\n    <p class="tags">{for tag in post.tags}{tag} {/for}</p>\n    <div>{post.content}</div>\n    {!\n    <div>Commented-out section</div>\n    !}\n  </article>\n  {for comment in post.comments}\n  {>comment}\n  {/for}\n  {if not post.comments}\n  <p>No comments have yet been made.</p>\n  {/if}\n  {>addcomment}\n{/for}\n</section>\n{/if}\n{if not posts}\n<p>No posts!</p>\n{/if}';
  var context = {
    blog: {
      title: "Scrumptious lessons"
    },
    posts: [
      {
        title: "A happy time",
        content: "<p>In my childhood I would laugh and play.</p>",
        author: "Hornsby Sumpin",
        tags: ["happy", "fun", "joy"]
      },
      {
        title: "Better days",
        content: "<p>Pals are a necessity in this lonely world.</p>",
        author: "Baffle McCough",
        tags: ["mirth", "briny", "pith"],
        comments: [
          {
            content: "I stand in complete agreement.",
            author: "Bitters Compote"
          },
          {
            content: "What a baleful load of beeswax.",
            author: "Gluglug Baldag"
          }
        ]
      },
      {
        title: "True madness",
        content: "<p>Let us begin again, as we were when we were babies.</p><p>Further and further from the truth we could never travel.</p>",
        tags: ["malaise"],
        comments: [
          {
            content: "I am comforted by our debate.",
            author: "Mildrand Brumpup"
          }
        ]
      }
    ]
  };
  var partials = {
    comment: '<section class="comment">\n  <header>\n    <h1>A comment on {post.title}{if post.author}, written by {post.author}{/if}</h1>\n    <p class="by">{comment.author}</p>\n  </header>\n  <div>{comment.content}</div>\n</section>',
    addcomment: '<section class="add-comment">\n  <form action="post">\n    <p><label for="name">Name:</label></p>\n    <p><input type="text" id="name" name="name"></p>\n    <textarea></textarea>\n    <p><input type="submit" name="submit" value="Submit"></p>\n  </form>\n</section>'
  };
  var expected = '<h1>Scrumptious lessons</h1>\n\n<section id="posts">\n\n  <article>\n    <header>\n      <h1>A happy time</h1>\n      <p class="by">Hornsby Sumpin</p>\n    </header>\n    <p class="tags">happy fun joy </p>\n    <div><p>In my childhood I would laugh and play.</p></div>\n    \n  </article>\n  \n  \n  <p>No comments have yet been made.</p>\n  \n  <section class="add-comment">\n  <form action="post">\n    <p><label for="name">Name:</label></p>\n    <p><input type="text" id="name" name="name"></p>\n    <textarea></textarea>\n    <p><input type="submit" name="submit" value="Submit"></p>\n  </form>\n</section>\n\n  <article>\n    <header>\n      <h1>Better days</h1>\n      <p class="by">Baffle McCough</p>\n    </header>\n    <p class="tags">mirth briny pith </p>\n    <div><p>Pals are a necessity in this lonely world.</p></div>\n    \n  </article>\n  \n  <section class="comment">\n  <header>\n    <h1>A comment on Better days, written by Baffle McCough</h1>\n    <p class="by">Bitters Compote</p>\n  </header>\n  <div>I stand in complete agreement.</div>\n</section>\n  \n  <section class="comment">\n  <header>\n    <h1>A comment on Better days, written by Baffle McCough</h1>\n    <p class="by">Gluglug Baldag</p>\n  </header>\n  <div>What a baleful load of beeswax.</div>\n</section>\n  \n  \n  <section class="add-comment">\n  <form action="post">\n    <p><label for="name">Name:</label></p>\n    <p><input type="text" id="name" name="name"></p>\n    <textarea></textarea>\n    <p><input type="submit" name="submit" value="Submit"></p>\n  </form>\n</section>\n\n  <article>\n    <header>\n      <h1>True madness</h1>\n      <p class="by"></p>\n    </header>\n    <p class="tags">malaise </p>\n    <div><p>Let us begin again, as we were when we were babies.</p><p>Further and further from the truth we could never travel.</p></div>\n    \n  </article>\n  \n  <section class="comment">\n  <header>\n    <h1>A comment on True madness</h1>\n    <p class="by">Mildrand Brumpup</p>\n  </header>\n  <div>I am comforted by our debate.</div>\n</section>\n  \n  \n  <section class="add-comment">\n  <form action="post">\n    <p><label for="name">Name:</label></p>\n    <p><input type="text" id="name" name="name"></p>\n    <textarea></textarea>\n    <p><input type="submit" name="submit" value="Submit"></p>\n  </form>\n</section>\n\n</section>\n\n';
  var rendered = whiskers.render(template, context, partials);
  //document.write(rendered);
  equal(rendered, expected, 'rendered and expected differ');
});
