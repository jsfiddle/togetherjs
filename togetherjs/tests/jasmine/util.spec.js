define(['util'], function(util) {
  'use strict';
  describe('Util', function() {
    describe('util.trim', function() {
      var testString;

      beforeEach(function(){
        testString = 'test';
      });

      it('should trim whitespace from the start of a string', function() {
        expect(util.trim('  ' + testString)).toEqual(testString);
      });

      it('should trim whitespace from the end of a string', function() {
        expect(util.trim(testString + '  ')).toEqual(testString);
      });

      it('should trim whitespace from both ends of a string', function() {
        expect(util.trim('  ' + testString + '  ')).toEqual(testString);
      });

      it('should not change a string with whitespace in the middle', function() {
        var longTestString = testString + ' ' + testString;

        expect(util.trim(longTestString)).toEqual(longTestString);
      });
    });
  });
});

