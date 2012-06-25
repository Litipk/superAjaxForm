(function($){
	var settings = {
		responseType: 'json',
		showProgress: function(loaded, total){},
		progressFallback: function(){},
		onAbort: function(){},
		responseHandlers: {
			200: function(responseText){},
			400: function(responseText){},
			fallback: function(responseText){}
		}
	};
	
	var methods = {
		submiter: function(evt){
			var $this  = $(this),
				inputs = $this.find(':input'),
				xhr = new XMLHttpRequest();
			
			evt.preventDefault();
			
			if (xhr.upload) {
				xhr.upload.addEventListener('progress', methods.onprogress, false);
			} else {
				$this.onprogress = methods.onprogress;
			}
			
			xhr.onreadystatechange = function(){
				if(xhr.readyState == 4){
					var response = (settings.responseType=='json')?
						$.parseJSON(xhr.responseText):
						xhr.responseText;
					
					if (settings.responseHandlers[xhr.status]){
						settings.responseHandlers[xhr.status](response);
					} else {
						settings.responseHandlers.fallback(response);
					}
				}
			}
			
			xhr.onabort = settings.onAbort();
			xhr.open('POST', $this.attr('action'), true);
			
			if (window.FormData) {
				xhr.send(new FormData(this));
			} else if(window.File && window.FileList && (xhr.sendAsBinary || window.Uint8Array)) {
				// Special Case: FF3/FF4
				// We use random boundaries to difficult (only a little bit) attacks through prepared files
				var boundary = '----'+methods.randomstring(8)+'----',
					std_inputs = $this.find(':input').filter('[type!="file"]'),
					file_inputs = $this.find('input[type="file"]'),
					num_file_inputs = file_inputs.length,
					dashdash = '--',
					crlf = '\r\n',
					builder = '';
				
				std_inputs.each(function(){
					builder += dashdash+boundary+crlf;
					builder += 'Content-disposition: form-data; name="'+$(this).attr('name')+'"'+crlf+crlf+$(this).val()+crlf;
				});
				
				for(var i=0; i<num_file_inputs; i++) {
					var file_input = $(file_inputs[i]),
						input_files = file_input[0].files,
						num_files = input_files.length;
					
					if (num_files == 0) continue;
					if (num_files == 1) {
						var input_file = input_files[0];
						if (input_file) {
							builder += dashdash+boundary+crlf;
							builder += 'Content-disposition: form-data; name="'+file_input.attr('name')+'"; filename="'+unescape(encodeURIComponent(methods.getfilename(input_file)))+'"'+crlf;
							builder += 'Content-Type: application/octet-stream'+crlf;
							builder += 'Content-Transfer-Encoding: binary'+crlf+crlf;
							builder += methods.readFileSynchronously (input_file);
							builder += crlf;
						}
					} else {
						var localBoundary = '--'+methods.randomstring(10)+'--';
						builder += dashdash+boundary+crlf;
						builder += 'Content-disposition: form-data; name="'+file_input.attr('name')+'";'+crlf;
						builder += 'Content-type: multipart/mixed, boundary='+localBoundary+crlf+crlf;
						for(var j=0; j<num_files; j++){
							var input_file = input_files[j];
							builder += dashdash+localBoundary+crlf;
							builder += 'Content-disposition: attachment; filename="'+unescape(encodeURIComponent(methods.getfilename(input_file)))+'"'+crlf;
							builder += 'Content-Type: application/octet-stream'+crlf;
							builder += 'Content-Transfer-Encoding: binary'+crlf+crlf;
							builder += methods.readFileSynchronously (input_file);
							builder += crlf;
						}
						builder += dashdash+localBoundary+dashdash+crlf;
					}
				}
				
				// End
				builder += dashdash+boundary+dashdash+crlf;
				xhr.setRequestHeader('content-type', 'multipart/form-data; boundary=' + boundary);
				
				if (!xhr.sendAsBinary) {
					XMLHttpRequest.prototype.sendAsBinary = function(datastr) {
						function byteValue(x) {
							return x.charCodeAt(0) & 0xff;
						}
						var ords = Array.prototype.map.call(datastr, byteValue),
							ui8a = new Uint8Array(ords);
						this.send(ui8a.buffer);
					}
				}
				xhr.sendAsBinary(builder);
			} else {
				// Fallback: We try to send at least all fields except files
				$.ajax({
					type: 'POST',
					data: $(this).serialize(),
					dataType: (settings.responseType=='json')?'json':'html',
					url: $(this).attr('action'),
					success: function(msg){
						settings.responseHandlers[200](msg);
					},
					error: function (xhr, ajaxOptions, thrownError) {
						var msg = (settings.responseType=='json')?
							$.parseJSON(xhr.responseText):
							xhr.responseText;
						settings.responseHandlers.fallback(msg);
					}
				});
			}
		},
		onprogress: function(evt){
			if (evt.lengthComputable){
				settings.showProgress(evt.loaded, evt.total);
			} else {
				settings.progressFallback();
			}
		},
		randomstring: function(n){
			var AA = '._-+*#0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
				lA = AA.length,rs = '';
			for (var i=0;i<n;i++) {
				rs += AA[Math.floor((Math.random()*n))]; 
			}
			return rs;
		},
		getfilename: function(file){return file.name||file.fileName;},
		readFileSynchronously: function (file) {
			if (window.FileReader) {
				var reader = new FileReader(),
					waiterLoop = function () {
						if (reader.readyState == 2) return;
						setTimeout(function(){
							waiterLoop();
						},100);
					};
				
				reader.readAsBinaryString(file);
				waiterLoop();
				
				return reader.result;
			} else if (file.getAsBinary) {
				return file.getAsBinary();
			}
		}
	}
	
	$.fn.superAjaxForm = function(options){
		settings = $.extend(settings, options);
		return this.each(function(){
			$(this).on('submit.superAjaxForm', methods.submiter);
		});
	};
})(jQuery);
