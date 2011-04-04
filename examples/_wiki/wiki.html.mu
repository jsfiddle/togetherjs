<html>
	<head>
		<style type="text/css" media="screen">
			body {
				overflow: hidden;
			}

			#left {
				margin: 0;
				position: fixed;
				overflow: scroll;
				float: left;
				top: 0;
				bottom: 0;
				left: 0;
				right: 0;
				width: 50%;
			}
			
			#view {
				padding-left: 30px;
			}
			
			#editor { 
				margin: 0;
				position: fixed;
				top: 0;
				bottom: 0;
				left: 50%;
				width: 50%;
				right: 0;
			}
		</style>
		<link href="/style.css" rel="stylesheet" type="text/css">
	</head>

	<body>
		<div id="left">
			<div id="view" class="content">{{{markdown}}}</div>
		</div>
		<div id="editor">{{{content}}}</div>
		<script src="/lib/markdown/showdown.js" type="text/javascript"></script>
		<script src="/lib/ace/ace.js" type="text/javascript" charset="utf-8"></script>
		<script src="/socket.io/socket.io.js"></script>
		<script src="/share.js"></script>
		<script src="../lib/ace.js"></script>
		<script>

    window.onload = function() {
		var converter = new Showdown.converter();
		var view = document.getElementById('view');

        var editor = ace.edit("editor");
		editor.setReadOnly(true);
		editor.session.setUseWrapMode(true);
		editor.setShowPrintMargin(false);

		var connection = new sharejs.Connection(window.location.hostname, 8000);

		connection.getOrCreate('{{{docName}}}', function(doc, error) {
			if (error) {
				console.error(error);
				return;
			}
			doc.attach_ace(editor);
			editor.setReadOnly(false);

			var render = function() {
				view.innerHTML = converter.makeHtml(doc.snapshot);
			};

			window.doc = doc;

			render();
			doc.subscribe('change', render);
		});
    };
		</script>
	</body>
</html>	

