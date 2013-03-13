/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

(function () {

var $ = window.$;

function Canvas(size) {
  size = size || {width: 300, height: 300};
  this.px = size.width / 10;
  this.px_s = this.px / 2;
  this.size = size;
  this.canvas = $("<canvas>");
  this.canvas.attr('width', this.size.width);
  this.canvas.attr('height', this.size.height);
  this.ctx = this.canvas[0].getContext('2d');
}

Canvas.prototype = {

  newAvatar : function() {
    // Background gradient
    var cxlg = this.ctx.createLinearGradient(0, 0, this.size.width, this.size.height);
    cxlg.addColorStop(0, '#555');
    cxlg.addColorStop(0.5, '#ccc');
    cxlg.addColorStop(1.0, '#666');
    this.ctx.fillStyle = cxlg;

    this.ctx.fillRect(0,0,300,300);
    this.ctx.fillRect(300,0,300,300);
    this.ctx.fillRect(0,300,300,300);

    // Face
    this.face();

    // Eyes
    this.eyes();

    // Mouth
    this.mouth();

    // Hair
    this.hair();

    // Body
    this.body();
  },

  toImgSrc : function() {
    var img_src = this.canvas[0].toDataURL("image/png");
    return img_src;
  },

  /**
   * Face
   */
  face: function() {
    var faces = [
        [ // F@ face
          [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3.5],
          [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
          [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
          [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 5.5]
        ],
        [ // Normal face
          [3, 3], [4, 3], [5, 3], [6, 3],
          [3, 4], [4, 4], [5, 4], [6, 4],
          [3, 5], [4, 5], [5, 5], [6, 5],
          [3, 6], [4, 6], [5, 6]
        ],
        [ // Alien face
          [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
          [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4],
          [3, 5], [4, 5], [5, 5], [6, 5],
          [3, 6], [4, 6], [5, 6]
        ]
    ];

    // Face
    this.draw(
      randomColor(),
      pick(faces)
    );
  },

  /**
   * Eyes
   */
  eyes: function() {
    var eyesData = [
          [
           [4, 4], [6, 4]
          ]
    ];

    // Eyes
    this.draw(randomColor(), pick(eyesData));

    var pupil = [
         [[4.5, 4],   [6.5, 4]],
         [[4.5, 4.5], [6.5, 4.5]],
         [[4, 4.5],   [6, 4.5]],
         [[4, 4],     [6.5, 4.5]],
         [[4.5, 4.5], [6, 4]],
         []
    ];

    // Pupil
    this.draw(
      randomColor(),
      pick(pupil),
      this.px_s
    );
  },

  mouth: function() {
    // Mouth
    var mouths = [
      [[4, 6], [5, 6]]
    ];

    this.draw(
      randomColor(),
      pick(mouths)
    );

    // Decorations
    var decorations = [
      [[5, 6]],
      [[4, 6], [4.5, 6.5], [5, 6], [5.5, 6.5]],
      []
    ];

    this.draw(
      randomColor(),
      pick(decorations),
      this.px_s
    );
  },

  /**
   * Hair
   */
  hair: function() {
    var hairData = [
          [
                     [4, 0.5], [5, 0.5], [6,0],
           [3, 1.5], [4, 1],   [5, 1],   [6, 1],
           [3, 2.5], [4, 2],   [5, 2],   [6, 2]
          ],
          [
           [4, 0.5], [5, 0.5],[6,0],[7,0],
           [2, 1.5],[3, 1.5], [4, 1],  [5, 1], [6, 1],
           [2, 2.5], [3, 2.5], [4, 2],  [5, 2], [6, 2], [7, 2]
          ],
          [
           [4, 0.5],[5, 0.5],
           [2, 1.5],[3, 1.5], [4, 1.5],  [5, 1.5], [6, 1.5], [7, 1.5],
           [1, 2.5],[2, 2.5], [3, 2.5],  [4, 2.5], [5, 2.5], [6, 2.5], [7, 2.5], [8, 2.5]
          ],
          [
           [2, 0.5], [7, 0.5],
           [2, 1.5], [3, 2],   [4, 1.5], [5, 1.5], [6, 2], [7, 1.5],
           [2, 2.5], [4, 2.5], [5, 2.5], [7, 2.5]
          ],
          []
    ];

    this.draw(
      randomColor(),
      pick(hairData)
    );
  },

  /**
   * Body
   */
  body: function() {
    var bodys = [
         [
                  [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
          [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8],
          [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9]
         ],
         [
          [2, 7], [3, 7], [4, 7], [5, 7], [5, 7], [6, 7], [7, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8],
  [0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]
         ]
    ];

    // Body
    this.draw(randomColor(), pick(bodys));

    // Decorations
    var body_decorations = [
           [ // Tie
             [3, 7], [5, 7],
             [4, 8],
             [4, 9]
           ],
           []
    ];

    this.draw(
      randomColor(),
      pick(body_decorations)
    );

    // Decorations 2
    var body_decorations_2 = [
            [
                [3.5, 7.5], [5, 7], [5, 7],
                [4, 8],
                [4, 9]
            ],
            [
             [3, 8.5], [5.5, 8.5],
             [2.5, 9], [6, 9],
             [2.5, 9.5], [5.5, 9.5]
            ],
     ];

     this.draw(
       randomColor(),
       pick(body_decorations_2),
       this.px_s
     );
  },

  /**
   * Draw something.
   */
  draw: function(color, coords, size) {
    var self = this;
    $.each(coords, function(i, v) {

        var _size = self.px;

        if (size !== undefined) {
            _size = size;
        }

        self.ctx.fillStyle = color;
        self.ctx.fillRect(coords[i][0] * self.px, coords[i][1] * self.px, _size, _size);
    });
  }

};

function pick(seq) {
  return seq[Math.floor(seq.length * Math.random())];
}

/*
 * Return a random color as hex.
 */
function randomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
}

if (typeof define != "undefined") {
    // We're in an AMD/require.js context
    define(["jquery"], function (jQuery) {
      $ = jQuery;
      return Canvas;
    });
} else {
    window.Canvas = Canvas;
}

})();
