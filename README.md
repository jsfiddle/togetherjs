### What is TogetherJS?
-----------------

TogetherJS is a service for your website that makes it surprisingly easy to collaborate in real-time.


### To be used with With OPEN_EDX, installing on a custom hub:

<pre>
heroku login
git clone git@github.com:mozilla/togetherjs.git
cd togetherjs/
heroku create
heroku config:add HOST=0.0.0.0
git push heroku HEAD:master

# to start the website in browser (optional in this case)
heroku open


#check trail of logs to see chat messages(server.js just logs the chat messages as of now!):
heroku logs --tail

</pre>

current url: https://calm-escarpment-25279.herokuapp.com/