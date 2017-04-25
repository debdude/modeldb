var async = require('async');
var Thrift = require('./thrift.js');
var moment = require('moment')

module.exports = {

  getAnnotations: function(modelId, callback) {
    Thrift.client.getModel(modelId, function(err, response) {
      callback(response.annotations);
    });
  },

  getExperimentsAndRuns: function(projectId, callback) {
    Thrift.client.getRunsAndExperimentsInProject(projectId, function(err, response) {
      callback(response);
    });
  },

  getModel: function(modelId, callback) {
    Thrift.client.getModel(modelId, function(err, response) {
      var model_metrics = response.metrics;
      var metrics =[];
      response.show = false;
      for (key in model_metrics) {
        if (model_metrics.hasOwnProperty(key)) {
          var val = Object.keys(model_metrics[key]).map(function(k){return model_metrics[key][k]})[0];
          val = Math.round(parseFloat(val) * 1000) / 1000;
          metrics.push({
            "key": key,
            "val": val
          });
          response.show = true;
        }
      }
      response.metrics = metrics;
      console.log(response);
      callback(response);
    });
  },

  getModelAncestry: function(modelId, callback) {
    Thrift.client.computeModelAncestry(modelId, function(err, response) {
      //console.log(response);
      callback(response);
    });
  },

  getProjectModels: function(projectId, callback) {
    var models = [];

    Thrift.client.getRunsAndExperimentsInProject(projectId, function(err, response) {
      var runs = response.experimentRuns;

      async.each(runs, function(item, finish) {
        Thrift.client.getExperimentRunDetails(item.id, function(err, response) {
          Array.prototype.push.apply(models,response.modelResponses);
          finish();
        });
      }, function(err) {

        // reformat metrics
        for (var i=0; i<models.length; i++) {
          var model_metrics = models[i].metrics;
          var metrics = [];
          models[i].show = false;
          for (key in model_metrics) {
            if (model_metrics.hasOwnProperty(key)) {
              var val = Object.keys(model_metrics[key]).map(function(k){return model_metrics[key][k]})[0];
              val = Math.round(parseFloat(val) * 1000) / 1000;
              metrics.push({
                "key": key,
                "val": val
              });
              models[i].show = true;
            }
          }

          models[i].metrics = metrics;
        }
        models = models.filter(function(model) {
          return model.show;
        });
        callback(models);
      });
    });
  },

  getProject: function(projectId, callback) {
    Thrift.client.getProjectOverviews(function(err, response) {
      for (var i=0; i<response.length; i++) {
        var project = response[i].project;
        if (project.id == projectId) {
          callback(project);
          return;
        }
      }
      callback(null);
    });
  },

  getProjects: function(callback) {
    //Project.getAll(callback);
    Thrift.client.getProjectOverviews(function(err, response) {
      callback(response);
    });
  },

  storeAnnotation: function(modelId, experimentRunId, string, callback) {
    var transformer = new Transformer({id: modelId});
    var fragment1 = new AnnotationFragment({
      type: "transformer",
      df: null,
      spec: null,
      transformer: transformer,
      message: null
    });

    var fragment2 = new AnnotationFragment({
      type: "message",
      df: null,
      spec: null,
      transformer: null,
      message: string
    });

    var annotationEvent = new AnnotationEvent({
      fragments: [fragment1, fragment2],
      experimentRunId: experimentRunId
    });

    console.log(annotationEvent);

    Thrift.client.storeAnnotationEvent(annotationEvent, function(err, response) {
      callback(response);
    });
  },

  editMetadata: function(modelId, kvPairs, callback) {
    var count = 0;
    var numKvPairs = Object.keys(kvPairs).length;
    for (var key in kvPairs) {
      var valueString = kvPairs[key];
      if (valueString === Array) {
        // var valueIndex = ??
        Thrift.client.updateVectorField(modelId, key, valueIndex, value, valueType, function(err, response) {
          callback(response);
        });
      } else {
        var valueType;
        if (isNaN(valueString)) {
          if (valueString === 'true' || valueString === 'false') {
            value = valueString === 'true';
            valueType = 'bool';
          } else {
            valueType = moment(valueString).isValid() ? 'datetime': 'string';
            value = valueString;
          }
        } else {
          if (valueString.indexOf('.') != -1) {
            value = parseFloat(valueString);
            valueType = 'double';
          } else {
            value = parseInt(valueString);
            valueType = value > 2**31 - 1 ? 'long': 'int';
          }
        }
        Thrift.client.createOrUpdateScalarField(modelId, key, value, valueType, function(err, response) {  
          count += 1;
          console.log(count, numKvPairs, count === numKvPairs);
          if (count === numKvPairs) {
            callback(response);
          }
        });
      }
    }    
  }

};
