exports.find_candidate_mp_files=find_candidate_mp_files;
exports.get_spec_from_mp_file=get_spec_from_mp_file;
exports.get_processor_specs=get_processor_specs;
exports.get_processor_spec=get_processor_spec;
exports.starts_with=starts_with;
exports.ends_with=ends_with;
exports.foreach_async=foreach_async;
exports.mkdir_if_needed=mkdir_if_needed;
exports.stat_file=stat_file;
exports.parse_json=parse_json;
exports.read_json_file=read_json_file;
exports.write_json_file=write_json_file;
exports.read_text_file=read_text_file;
exports.write_text_file=write_text_file;
exports.read_dir_safe=read_dir_safe;
exports.temporary_directory=temporary_directory;
exports.make_random_id=make_random_id;
exports.prv_search_directories=prv_search_directories;
exports.package_search_directories=package_search_directories;
exports.config_file_path=config_file_path;

var sha1 = require('node-sha1');
var db_utils=require(__dirname+'/db_utils.js');

function get_processor_specs(opts,callback) {
	find_candidate_mp_files(opts,function(err,mp_file_names) {
		if (err) {
			callback(err);
			return;
		}
		var list=[];
		foreach_async(mp_file_names,function(ii,fname,cb) {
			get_spec_from_mp_file(fname,function(err,spec0) {
				if (err) {
					callback(err);
					return;
				}
				if (spec0) {
					var processors=spec0.processors||[];
					for (var j in processors) {
						list.push(processors[j]);
					}
				}
				else {
					if (opts.show_warnings) {
						console.warn(`Problem getting spec from file: ${fname}`);
					}
				}
				cb();
			});
		},function() {
			callback(null,list);
		});
	});
}

function get_processor_spec(processor_name,opts,callback) {
	get_processor_specs(opts,function(err,processor_specs) {
		if (err) {
			callback(err);
			return;
		}
		for (var i in processor_specs) {
			var spec0=processor_specs[i];
			var pname=spec0.name||'';
			if (pname==processor_name) {
				callback(null,spec0);
				return;
			}
		}
		callback(null,null);
	});
}

function find_candidate_mp_files(opts,callback) {
	var list=[];
	var paths=package_search_directories(opts);
	foreach_async(paths,function(ii,path0,cb) {
		find_candidate_mp_files_in_directory(path0,function(err,list0) {
			if (err) {
				callback(err);
				return;
			}
			for (var i in list0) {
				list.push(list0[i]);
			}	
			cb();
		});
	},function() {
		callback(null,list);	
	});
}

function find_candidate_mp_files_in_directory(path,callback) {
	var list=[];
	var files=read_dir_safe(path);
	foreach_async(files,function(ii,file,cb) {
		var fname=path+'/'+file;
		var stat0=stat_file(fname);
		if (stat0) {
			if (stat0.isFile()) {
				if (ends_with(fname,'.mp')) {
					if (is_executable(fname)) {
						list.push(fname);
					}
				}
				cb();
			}
			else if (stat0.isDirectory()) {
				find_candidate_mp_files_in_directory(fname,function(err,list0) {
					if (err) {
						callback(err);
						return;
					}
					for (var j in list0) {
						list.push(list0[j]);
					}
					cb();
				});
			}
		}
	},function() {
		callback(null,list);	
	});
}

function get_spec_from_mp_file(fname,callback) {
	if (is_executable(fname)) {
		db_utils.findDocuments('processor_specs',{mp_file_path:fname},function(err,docs) {
			if (err) {
				callback(err);
				return;
			}
			for (var i in docs) {
				var doc0=docs[i];
				if ((doc0.timestamp)&&(doc0.spec)) {
					var elapsed=(new Date())-doc0.timestamp;
					if (elapsed<10*1000) {
						callback(null,doc0.spec);
						return;
					}
				}
			}
			var output=run_program_and_read_output(fname+' spec');
			var spec0=parse_json(output);
			var doc0={
				mp_file_path:fname,
				spec:spec0,
				timestamp:((new Date())-0)
			}
			db_utils.saveDocument('processor_specs',doc0,function(err) {
				callback(null,spec0);	
			})
		});
	}
	else {
		callback(null,null);
	}
}

function package_search_directories(opts) {
	var list=[];
	var ml_packages_path=process.env.ML_PACKAGE_SEARCH_DIRECTORY||(process.env.HOME+'/.mountainlab/packages');
	list.push(ml_packages_path);
	list.push(require('path').resolve(__dirname,'../system-packages'));
	var ml_additional_packages_paths=(process.env.ML_ADDITIONAL_PACKAGE_SEARCH_DIRECTORIES||'').split(':');
	for (var i in ml_additional_packages_paths) {
		if (ml_additional_packages_paths[i])
			list.push(ml_additional_packages_paths[i]);
	}
	return list;
}

function parse_json(str) {
	try {
		return JSON.parse(str);
	}
	catch(err) {
		return null;
	}
}

function run_program_and_read_output(cmd) {
	var r = require('child_process').execSync(cmd);
	var str=r.toString();
	return str;
}

function starts_with(str,str2) {
	return (String(str).slice(0,str2.length)==str2);
}

function ends_with(str,str2) {
    return (str.slice(str.length-str2.length)==str2);
}

function read_dir_safe(path) {
	try {
		return require('fs').readdirSync(path);
	}
	catch(err) {
		return [];
	}
}

function stat_file(fname) {
	try {
		return require('fs').statSync(fname);
	}
	catch(err) {
		return null;
	}
}

function prv_search_directories() {
	var ret=[];
	//ret.push(process.cwd());
	ret.push(temporary_directory());
	var ml_additional_prv_search_directories=(process.env.ML_ADDITIONAL_PRV_SEARCH_DIRECTORIES||'').split(':');
	for (var i in ml_additional_prv_search_directories) {
		if (ml_additional_prv_search_directories[i]) {
			ret.push(ml_additional_prv_search_directories[i]);
		}
	}
	return ret;
}

function config_file_path() {
	return process.env.ML_CONFIG_FILE||(process.env.HOME+'/.mountainlab/mountainlab.env');
}

function is_executable(fname) {
	var stat0=stat_file(fname);
	var mask=1; //use 1 for executable, 2 for write, 4 for read
	return !!(mask & parseInt ((stat0.mode & parseInt ("777", 8)).toString (8)[0]));
}

function foreach_async(list,step,callback) {
	var ii=0;
	next_step();
	function next_step() {
		if (ii>=list.length) {
			callback();
			return;
		}
		step(ii,list[ii],function() {
			ii++;
			setTimeout(function() {
				next_step();
			},0);
		});
	}
}

function mkdir_if_needed(path) {
  try {
    require('fs').mkdirSync(path);
  }
  catch(err) {
  }
}

function read_json_file(fname) {
	try {
		var txt=require('fs').readFileSync(fname,'utf8')
		return parse_json(txt);
	}
	catch(err) {
		return null;
	}
}

function read_text_file(fname) {
	try {
		var txt=require('fs').readFileSync(fname,'utf8')
		return txt;
	}
	catch(err) {
		return null;
	}
}

function write_json_file(fname,obj) {
	try {
		require('fs').writeFileSync(fname,JSON.stringify(obj));
		return true;
	}
	catch(err) {
		return false;
	}
}

function write_text_file(fname,txt) {
	try {
		require('fs').writeFileSync(fname,txt);
		return true;
	}
	catch(err) {
		return false;
	}
}

function temporary_directory() {
	var ml_temporary_directory=process.env.ML_TEMPORARY_DIRECTORY||('/tmp/mountainlab-tmp');
	mkdir_if_needed(ml_temporary_directory);
	return ml_temporary_directory;
}

function make_random_id(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < len; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}