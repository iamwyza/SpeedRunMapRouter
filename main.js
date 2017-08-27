/// <reference path="../../../../../node_modules/@types/leaflet/index.d.ts" />

var layer;
function init() {

    var defaultConfig = { //Much of this should move into a settings area eventually.
        PathColorPriority: [ //Pulled from the 100% NMG guide, arbitrary?
            "#ffff00",
            "#01fc01",
            "#ff8000",
            "#008000",
            "#00ffff"
        ],
        Controls: { //Currently using "keypress" vs "keydown" due to lack of "keydown" support in leaflet
            CancelPath: 120, //x
            RemoveLastPathPart: 99, //c
            SavePathPart: 13, //enter
            NewSegment: 115, //s
            DraggingToggle: 100, //d
            FreeLineCreation: 102, //f
        },
        DefaultNewSegmentFormat: "Segment: {0}",
        DefaultNewPathFormat: "Step: {0}"
    };

    var defaultData = {
        routes: [
            {
                name: "Route: 100% NMG",
                segments: [
                    {
                        name: "Segment: 1",
                        notes: "",
                        paths: [

                        ]
                    }

                ]
            },
            {
                name: "Route: Any% NMG",
                segments: []
            }
        ]
    };

    // Initialize Variables
    var currentColorIndex = -1;
    var currentRoute;
    var currentLine;
    var currentSegment = 0;
    var points = [];
    var isEditingRoute = false;
    var data;
    var config;
    var selectedLine;


    load();

    //Initialize Map
    var mapMinZoom = 0;
    var mapMaxZoom = 5;
    var map = L.map('map', {
        maxZoom: mapMaxZoom,
        minZoom: mapMinZoom,
        crs: L.CRS.Simple,
        boxZoom: false,
        contextmenu: true,


    }).setView([0, 0], mapMaxZoom);

    map.on('contextmenu.show', function (event) {
        if (event.relatedTarget != undefined)
            selectedLine = event.relatedTarget;
    });

    var legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        return L.DomUtil.get('legend');
    };

    legend.addTo(map);


    var customLine = L.Polyline.extend({
        options: {
            routeIndex: undefined,
            segment: undefined,
            decorator: undefined
        }
    });


    var mapBounds = new L.LatLngBounds(
        map.unproject([0, 3072], mapMaxZoom),
        map.unproject([4608, 0], mapMaxZoom));

    map.fitBounds(mapBounds);
    layer = L.tileLayer('{z}/{x}/{y}.png', {
        minZoom: mapMinZoom, maxZoom: mapMaxZoom,
        bounds: mapBounds,
        attribution: 'Rendered with <a href="https://www.maptiler.com/">MapTiler</a>',
        noWrap: true,
        tms: false,
        className: "Main"
    }).addTo(map);

    var pathLayer = L.layerGroup().addTo(map);

    function onMapKeypress(e) {
        if (isEditingRoute) {
            switch (e.originalEvent.keyCode) {
                case config.Controls.SavePathPart:

                    addArrow(currentLine);

                    if (currentRoute.segments == undefined || currentRoute.segments.length == 0) {
                        currentSegment = -1;
                        addSegment();
                    }

                    if (currentRoute.segments[currentSegment].paths == undefined)
                        currentRoute.segments[currentSegment].paths = [];

                    currentRoute.segments[currentSegment].paths.push(
                        {
                            name: config.DefaultNewPathFormat.replace("{0}", currentRoute.segments[currentSegment].paths.length + 1),
                            points: points,
                            notes: ""
                        }
                    );
                    currentLine.options.segment = currentRoute.segments[currentSegment];
                    addContextMenu(currentLine);
                    currentLine = undefined;
                    points = [];
                    break;
                case config.Controls.RemoveLastPathPart:
                    points.pop();
                    currentLine.setLatLngs(points);
                    break;
                case config.Controls.CancelPath:
                    points = [];
                    currentLine.removeFrom(map);
                    currentColorIndex--;
                    currentLine = undefined;
                    break;
                case config.Controls.NewSegment:
                    addSegment();
                    break;
                case config.Controls.DraggingToggle:
                    if (map.dragging._enabled)
                        map.dragging.disable();
                    else
                        map.dragging.enable();
                    break;
            }
        }
    }

    function addRoute(model) {

        var route = {
            name: "New Route",
            segments: [
                {
                    name: config.DefaultNewSegmentFormat.replace("{0}", currentSegment + 1),
                    notes: "",
                    paths: [

                    ]
                }
            ]
        };

        model.data.routes.push(route);

    }

    function addSegment() {

        currentLine = undefined;
        currentColorIndex = -1;
        currentSegment++;
        points = [];
        if (currentRoute.segments == undefined)
            currentRoute.segments = [];

        if (currentRoute.segments == 0)
            currentColorIndex = 0;

        currentRoute.segments.push({
            name: config.DefaultNewSegmentFormat.replace("{0}", currentSegment + 1),
            notes: "",
            paths: [

            ]
        });
    }

    var sidebar = L.control.sidebar('sidebar').addTo(map);

    rivets.binders.routes = {

        bind: function (el) {
            var opts = {};
            opts.onSet = this.publish;
        },

        unbind: function (el) {

        },

        routine: function (el, value) {
        },

        getValue: function (el) {

        }
    };

    var routeController = {
        enabled: false,
        headerClick: function (event, rivetData) {
            if (event.target.tagName == "I")
                return;

            rivetData.route.enabled = !rivetData.route.enabled;
            openRoute(rivetData);

        },
        edit: function (event, rivetData) {

            rivetData.route.enabled = true;
            openRoute(rivetData);

            if (rivetData.route.isEditingRoute) {
                rivetData.route.isEditingRoute = false;
                map.off('click', addPathSegment);
                map.off('keypress', onMapKeypress);
                map.dragging.enable();
                isEditingRoute = false;
            } else {
                currentRoute = rivetData.route;
                currentSegment = 0;
                isEditingRoute = true;
                currentRoute.isEditingRoute = isEditingRoute;
                map.dragging.disable();
                map.on('click', addPathSegment);
                map.on('keypress', onMapKeypress);
            }
        },
        addNewRoute: function (event, rivetData) {
            addRoute(rivetData);
        }
    };

    function openRoute(rivetData) {
        pathLayer.clearLayers();

        if (rivetData.route.enabled) {
            currentRoute = rivetData.route;
            currentSegment = 0;

            closeRoutes(rivetData);
            loadRoute(rivetData.route);
        }
    }

    function closeRoutes(rivetData) {
        $.each(rivetData.data.routes, function (i, e) {
            if (e != rivetData.route && (e.enabled || e.isEditingRoute)) {
                e.enabled = false;
                e.isEditingRoute = false;
                map.off('click', addPathSegment);
                map.off('keypress', onMapKeypress);
                map.dragging.enable();
                isEditingRoute = false;
            }
        });
    }


    function loadRoute(route) {
        $.each(route.segments, function (i, e) {
            currentColorIndex = -1;
            loadSegment(e);
        })
    }

    function loadSegment(segment) {
        $.each(segment.paths, function (i, e) {
            var line = new customLine(e.points, {
                color: getNextColor(),
                weight: 3,
                opacity: 1,
                smoothfactor: 1,
                routeIndex: i,
                segment: segment
            }).addTo(pathLayer);

            addContextMenu(line);

            addArrow(line);
        });
    }

    function addContextMenu(line) {
        line.bindContextMenu({
            contextmenu: true,
            contextmenuWidth: 140,
            contextmenuItems: [{
                text: 'Delete Step',
                callback: deletePath,
                context: line
            }]
        })
    }

    function deletePath() {
        selectedLine.options.segment.paths.splice(selectedLine.options.routeIndex, 1);
        selectedLine.options.decorator.remove();
        pathLayer.removeLayer(selectedLine);

    }

    function addArrow(line) {
        var decorator = L.polylineDecorator(line, {
            patterns: [
                // defines a pattern of 10px-wide dashes, repeated every 20px on the line
                { offset: '100%', repeat: 0, symbol: L.Symbol.arrowHead({ pixelSize: 8, polygon: false, pathOptions: { stroke: true, color: config.PathColorPriority[currentColorIndex], } }) }
            ]
        }).addTo(pathLayer);
        line.options.decorator = decorator;
    }

    function addPathSegment(e) {
        points.push(e.latlng);
        if (currentLine == undefined) {
            if (points.length > 1) {
                currentLine = new L.polyline(points, {
                    color: getNextColor(),
                    weight: 3,
                    opacity: 1,
                    smoothfactor: 1
                }).addTo(pathLayer);

            }
        } else {
            currentLine.addLatLng(e.latlng);
        }
    }

    var view = rivets.bind($('#routes'), { data: data, controller: routeController });
    var legend = rivets.bind($('#legend'), {
        config: config, isEditingRoute: true, showLegend: true, fromCharCode: function (e) {
            if (e == 13)
                return "Enter";
            return String.fromCharCode(e);
        }
    });

    function getNextColor() {
        if (currentColorIndex >= config.PathColorPriority.length - 1) {
            currentColorIndex = 0;
        } else {
            currentColorIndex++;
        }

        return config.PathColorPriority[currentColorIndex];

    }

    //Using local storage for now. If this thing takes off will probably need to switch this to server storage
    function save() {
        localStorage.setItem("srpData", JSON.stringify(data));
        localStorage.setItem("srpConfig", JSON.stringify(config));
    }

    function load() {
        data = JSON.parse(localStorage.getItem("srpData"));
        config = JSON.parse(localStorage.getItem("srpConfig"));
        if (data == undefined) {
            data = defaultData;
            config = defaultConfig;
        }
        $.each(data.routes, function (i, e) {
            e.enabled = false;
        });
    }

    $("#btnSave").on('click', function () {
        save();
    });

}