'use strict';

/**
 * @ngdoc function
 * @name offgridmonitoringApp.controller:BuildingSummaryCtrl
 * @description
 * # BuildingSummaryCtrl
 * Displays a summary of key indicators about a building.
 */
angular.module('offgridmonitoringApp')
  .controller('BuildingSummaryCtrl', function (Breadcrumb, Breadcrumbs, $routeParams, Building, Bridge, SensorTypes, State, $scope, $interval) {
  	var _this = this;

    this.building = Building.findById({
      id : $routeParams.buildingId,
      filter : {
        include : ['energySources', {'bridges' : 'sensors'}]
      }
    });

    this.energyFlowLabels = ['Consumption', 'Generation']

    this.energyFlowOptions = {
      legend: {
        display: true
      },
      tooltips: {
        callbacks : {
          label : function(tooltipItem, data) {
            var valueData = tooltipItem.yLabel;
            if (isNaN(valueData)) {
              return null; // Hide completely null values.
            }
            var label = data.datasets[tooltipItem.datasetIndex].label;
            var value = valueData.toFixed(0) + ' Watts';
            return label + ' : ' + value;
          }
        }
      },
      scales: {
        yAxes: [
          {
            scaleLabel: {
              display: true,
              labelString: 'Exponential Average Power (Watts)'
            },
            stacked: true
          }
        ],
        xAxes: [
          {
            stacked: true
          }
        ]
      }
    };

    this.batteryDiagramHeight = 200;

    // Gets the height for the battery level indicator.
    this.getBatteryLevelHeight = function() {
      var level = this.chargeLevel * this.batteryDiagramHeight;
      if (level > this.batteryDiagramHeight) {
        return this.batteryDiagramHeight;
      }
      if (level < 0) {
        return 0;
      }
      
      return level;
    };


    // Setup breadcrumbs.
    Breadcrumbs.addPlaceholder('Building', this.building.$promise, function(building) {
      return new Breadcrumb(building.name, '/' + $routeParams.buildingId);
    });

    this.building.$promise.then(function(building) {
      var bridge = building.bridges[0];
      
      // Load the summary then re-load it every minute after that.
      loadSummary(bridge);
      _this.refreshTimer = $interval(function() {
        loadSummary(bridge);
      }, 60*1000);
    });

    // Cancel the auto-refresh when the controller is destroyed.
    $scope.$on('$destroy', function() {
      if (_this.refreshTimer) {
        $interval.cancel(_this.refreshTimer);
      }
    });

    // Sets up the summary page.
    function loadSummary(bridge) {
      
      // Fetch down the current state.
      Building.currentState({
        id : $routeParams.buildingId
      }).$promise.then(function(currentState) {
        _this.state = currentState;
        _this.chargeLevel = currentState.currentChargeLevel / currentState.batteryCapacity;
        setupEnergyFlowGraph();
      });

      // TODO: Get 24 hour state data too.
    }

    // Sets up the energy flow graph using the state and building data.
    function setupEnergyFlowGraph() {
      // === Prepare energy flow data.
      var energyFlowData = {
        consumption: [],
        generation: []
      };

      // Add consumption data.
      energyFlowData.consumption.push({
        name : 'Building',
        value : _this.state.consumption.averagePower
      });
      
      // Add energy source data.
      energyFlowData.generation.push({
        name : _this.building.chargerEnergySourceName,
        value : _this.state.sources.charger.averagePower
      });

      // Add custom sources.
      angular.forEach(_this.building.energySources, function(energySource) {
        var sourceState = _this.state.sources[energySource.id];
        if (sourceState) {
          energyFlowData.generation.push({
            name : energySource.name,
            value : sourceState.averagePower
          });
        }
      });

      // Add other source.
      energyFlowData.generation.push({
        name : _this.building.otherEnergySourceName,
        value : _this.state.sources.other.averagePower
      });

      // === Setup energy flow data into the chart.js format.
      _this.energyFlowSeries = [];
      _this.energyFlowData = [];

      angular.forEach(energyFlowData.consumption, function(consumptionSeries) {
        _this.energyFlowSeries.push(consumptionSeries.name);
        _this.energyFlowData.push([consumptionSeries.value, null]);
      });

      angular.forEach(energyFlowData.generation, function(generationSeries) {
        _this.energyFlowSeries.push(generationSeries.name);
        _this.energyFlowData.push([null, generationSeries.value]);
      });
    }

  });
