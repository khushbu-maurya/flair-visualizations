var d3 = require('d3');
var COMMON = require('../extras/common.js')();
var UTIL = require('../extras/util.js')();
var LEGEND = require('../extras/legend.js')();
try {
    var d3Lasso = require("d3-lasso");

} catch (ex) { }
function pie() {

    /* These are the constant global variable for the function pie.
     */
    var _NAME = 'pie';

    /* These are the private variables that is initialized by the arguments sent
     * by the users and can be updated using public methods.
     */
    var _config,
        _dimension,
        _measure,
        _legend,
        _legendPosition,
        _valueAs,
        _valueAsArc,
        _valuePosition,
        _sort,
        _tooltip,
        _print,
        broadcast,
        filterParameters;;

    /* These are the common variables that is shared across the different private/public
     * methods but is initialized/updated within the methods itself.
     */
    var _localSVG,
        _localTotal = 0,
        _localTransitionTime = 500,
        _localTransitionMap = d3.map(),
        _localSortedMeasureValue = [],
        _localTooltip,
        _localKey,
        _localLegend,
        _localLabelStack = [],
        _localData,
        _originalData;

    var filter = false, filterData = [], div;

    /* These are the common private functions that is shared across the different private/public
     * methods but is initialized beforehand.
     */
    var _pie = d3.pie()
        .sort(null);

    var _arc = d3.arc()
        .innerRadius(0);

    var _arcMask = d3.arc();

    var _labelArc = d3.arc();

    /* -------------------------------------------------------------------------------- */
    var _setConfigParams = function (config) {
        this.dimension(config.dimension);
        this.measure(config.measure);
        this.legend(config.legend);
        this.legendPosition(config.legendPosition);
        this.valueAs(config.valueAs);
        this.valueAsArc(config.valueAsArc);
        this.valuePosition(config.valuePosition);
        this.tooltip(config.tooltip);
    }

    /**
     * Period function that stretches the rendering process
     *
     * @param {number} extraDuration Additional duration value in milliseconds
     * @return {function} Accessor function that computes the duration period
     */
    var _durationFn = function (extraDuration) {
        if (extraDuration === void 0) { extraDuration = 0; }

        if (isNaN(+extraDuration)) {
            throw new TypeError('Not a number');
        }

        return function (d, i) {
            var t = _localTransitionMap.get(d.value);

            if (!t) {
                t = _localTransitionTime * (d.value / _localTotal)
                _localTransitionMap.set(d.value, t);
            }

            return (t + extraDuration);
        }
    }

    /**
     * Delay function that delays the start of rendering process
     *
     * @param {number} extraDelay Additional delay value in milliseconds
     * @return {function} Accessor function that computes the delay period
     */
    var _delayFn = function (extraDelay) {
        if (extraDelay === void 0) { extraDelay = 0; }

        if (isNaN(+extraDelay)) {
            throw new TypeError('TypeError: Not a number');
        }

        return function (d, i) {
            var i = _localSortedMeasureValue.indexOf(d.value),
                t = 0;

            while (i > 0) {
                i--;
                t += _localTransitionMap.get(_localSortedMeasureValue[i]);
            }

            return (t + extraDelay);
        }
    }

    /**
     * Gives the value of hypotenuse using pythagorous theorem
     *
     * @param {number} x Value of perpendicular
     * @param {number} y Value of base
     * @return {number} Value of hypotenuse
     */
    var _pythagorousTheorem = function (x, y) {
        if (isNaN(+x) || isNaN(+y)) {
            throw new Error('TypeError: Not a number');
            return 0;
        }

        return Math.sqrt(Math.pow(+x, 2) + Math.pow(+y, 2));
    }

    /**
     * Label function to provide the label to be shown
     *
     * @return {function} Accessor function that identifies the label text
     */
    var _labelFn = function () {
        return function (d, i) {
            var result;

            switch (_valueAs) {
                case 'label':
                    result = d.data[_dimension[0]];
                    break;
                case 'value':
                    result = d.data[_measure[0]];
                    break;
                case 'percentage':
                    result = (100 * d.data[_measure[0]] / _localTotal).toFixed(2) + ' %';
                    break;
                default:
                    result = d.data[_dimension[0]];
            }

            return result;
        }
    }

    /**
     * Builds the html data for the tooltip
     *
     * @param {object} datum Datum forming the arc
     * @param {function} chart Pie chart function
     * @return {string} String encoded HTML data
     */
    var _buildTooltipData = function (datum, chart) {
        var output = "";

        output += "<table><tr>"
            + "<th>" + chart.dimension() + ": </th>"
            + "<td>" + datum[chart.dimension()] + "</td>"
            + "</tr><tr>"
            + "<th>" + chart.measure() + ": </th>"
            + "<td>" + datum[chart.measure()] + "</td>"
            + "</tr></table>";

        return output;
    }


    var onLassoStart = function (lasso, scope) {
        return function () {
            if (filter) {
                lasso.items().selectAll('path')
                    .classed('not_possible', true)
                    .classed('selected', false);
            }
        }
    }

    var onLassoDraw = function (lasso, scope) {
        return function () {
            filter = true;
            lasso.items().selectAll('path')
                .classed('selected', false);

            lasso.possibleItems().selectAll('path')
                .classed('not_possible', false)
                .classed('possible', true);

            lasso.notPossibleItems().selectAll('path')
                .classed('not_possible', true)
                .classed('possible', false);
        }
    }

    var onLassoEnd = function (lasso, scope) {
        return function () {
            var data = lasso.selectedItems().data();
            if (!filter) {
                return;
            }
            if (data.length > 0) {
                lasso.items().selectAll('path')
                    .classed('not_possible', false)
                    .classed('possible', false);
            }

            lasso.selectedItems().selectAll('path')
                .classed('selected', true)

            lasso.notSelectedItems().selectAll('path');

            var confirm = $(scope).parent().find('div.confirm')
                .css('visibility', 'visible');

            var _filter = [];
            data.forEach(function (d) {
                var obj = new Object();
                obj[chart.dimension()] = d.data[chart.dimension()]
                obj[chart.measure()] = d.data[chart.measure()]
                _filter.push(obj)
            });
            if (_filter.length > 0) {
                filterData = _filter;
            }
            if (broadcast) {
                var idWidget = broadcast.updateWidget[scope.parentElement.id];
                broadcast.updateWidget = {};
                broadcast.updateWidget[scope.parentElement.id] = idWidget;

                var _filterList = {}, list = []

                filterData.map(function (val) {
                    list.push(val[_dimension[0]])
                })
                _filterList[_dimension[0]] = list
                broadcast.filterSelection.filter = _filterList;
                filterParameters.save(_filterList);
            }
        }
    }

    var applyFilter = function () {
        return function () {
            if (filterData.length > 0) {
                //Viz renders twice issue
                // chart.update(filterData);
                if (broadcast) {
                    broadcast.updateWidget = {};
                    broadcast.filterSelection.id = null;
                    broadcast.$broadcast('flairbiApp:filter-input-refresh');
                    broadcast.$broadcast('flairbiApp:filter');
                    broadcast.$broadcast('flairbiApp:filter-add');
                    d3.select(this.parentNode)
                        .style('visibility', 'hidden');
                }
            }
        }
    }

    var clearFilter = function (div) {
        return function () {
            chart.update(_originalData);
            d3.select(div).select('.confirm')
                .style('visibility', 'hidden');
        }
    }
    var _handleMouseOverFn = function (tooltip, container) {
        var me = this;

        return function (d, i) {
            d3.select(this).style('cursor', 'pointer');
            var border = d3.select(this).attr('fill')
            var arcGroup = container.selectAll('g.arc')
                .filter(function (d1) {
                    return d1.data[_dimension[0]] === d.data[_dimension[0]];
                });

            arcGroup.select('path')
                .style('fill', COMMON.HIGHLIGHTER);

            var arcMaskGroup = container.selectAll('g.arc-mask')
                .filter(function (d1) {
                    return d1.data[_dimension[0]] === d.data[_dimension[0]];
                });

            arcMaskGroup.select('path')
                .style('visibility', 'visible');

            if (tooltip) {
                UTIL.showTooltip(tooltip);
                UTIL.updateTooltip.call(tooltip, _buildTooltipData(d.data, me), container, border);
            }
        }
    }

    var _handleMouseMoveFn = function (tooltip, container) {
        var me = this;

        return function (d, i) {
            if (tooltip) {
                UTIL.updateTooltip.call(tooltip, _buildTooltipData(d.data, me), container);
            }
        }
    }

    var _handleMouseOutFn = function (tooltip, container) {
        var me = this;

        return function (d, i) {
            d3.select(this).style('cursor', 'default');

            var arcGroup = container.selectAll('g.arc')
                .filter(function (d1) {
                    return d1.data[_dimension[0]] === d.data[_dimension[0]];
                });

            arcGroup.select('path')
                .style('fill', function (d1) {
                    return COMMON.COLORSCALE(d1.data[_dimension[0]]);
                });

            var arcMaskGroup = container.selectAll('g.arc-mask')
                .filter(function (d1) {
                    return d1.data[_dimension[0]] === d.data[_dimension[0]];
                });

            arcMaskGroup.select('path')
                .style('visibility', 'hidden');

            if (tooltip) {
                UTIL.hideTooltip(tooltip);
            }
        }
    }

    var _legendMouseOver = function (data, plot) {
        plot.selectAll('g.arc')
            .filter(function (d) {
                return d.data[_dimension[0]] === data[_dimension[0]];
            })
            .select('path')
            .style('fill', COMMON.HIGHLIGHTER);

        plot.selectAll('g.arc-mask')
            .filter(function (d) {
                return d.data[_dimension[0]] === data[_dimension[0]];
            })
            .select('path')
            .style('visibility', 'visible');
    }

    var _legendMouseMove = function (data, plot) {

    }

    var _legendMouseOut = function (data, plot) {
        plot.selectAll('g.arc')
            .filter(function (d) {
                return d.data[_dimension[0]] === data[_dimension[0]];
            })
            .select('path')
            .style('fill', function (d, i) {
                return COMMON.COLORSCALE(d.data[_dimension[0]]);
            });

        plot.selectAll('g.arc-mask')
            .filter(function (d) {
                return d.data[_dimension[0]] === data[_dimension[0]];
            })
            .select('path')
            .style('visibility', 'hidden');
    }

    var _legendClick = function (data) {
        if (_localLabelStack.indexOf(data[_dimension[0]]) < 0) {
            _localLabelStack.push(data[_dimension[0]]);
        } else {
            _localLabelStack.splice(_localLabelStack.indexOf(data[_dimension[0]]), 1);
        }

        chart.update(_localData);
    }

    var _mergeForTransition = function (fData, sData) {
        var secondSet = d3.set();

        sData.forEach(function (d) {
            secondSet.add(d[_dimension[0]]);
        });

        var onlyFirst = fData.filter(function (d) {
            return !secondSet.has(d[_dimension[0]]);
        })
            .map(function (d) {
                var obj = {};

                obj[_dimension[0]] = d[_dimension[0]];
                obj[_measure[0]] = 0;

                return obj;
            });

        return d3.merge([sData, onlyFirst])
            .sort(function (a, b) {
                return d3.ascending(a[_dimension[0]], b[_dimension[0]]);
            })
    }

    function chart(selection) {
        _localSVG = selection;

        selection.each(function (data) {
            var svg = d3.select(this),
                width = +svg.attr('width'),
                height = +svg.attr('height'),
                parentWidth = width - 2 * COMMON.PADDING,
                parentHeight = height - 2 * COMMON.PADDING,
                outerRadius;

            div = d3.select(this).node().parentNode;
            var me = this;

            /* total sum of the measure values */
            _localTotal = d3.sum(data.map(function (d) { return d[_measure[0]]; }));

            /* store the data in local variable */
            _localData = _originalData = data;

            /* applying sort operation to the data */
            // UTIL.sorter(data, _measure, _sort);

            // data.sort(function (a, b) {
            //     return d3.ascending(a[_dimension[0]], b[_dimension[0]]);
            // });

            /* extracting measure values only from the data */
            _localSortedMeasureValue = data.map(function (d) { return +d[_measure[0]]; })

            var container = svg.append('g')
                .classed('container', true)
                .attr('transform', 'translate(' + COMMON.PADDING + ', ' + COMMON.PADDING + ')');

            var legendWidth = 0,
                legendHeight = 0,
                plotWidth = parentWidth,
                plotHeight = parentHeight;

            if (_legend) {
                _localLegend = LEGEND.bind(chart);

                var result = _localLegend(data, container, {
                    width: parentWidth,
                    height: parentHeight
                });

                legendWidth = result.legendWidth;
                legendHeight = result.legendHeight;

                switch (_legendPosition) {
                    case 'top':
                    case 'bottom':
                        plotHeight = plotHeight - legendHeight;
                        break;
                    case 'right':
                    case 'left':
                        plotWidth = plotWidth - legendWidth;
                        break;
                }
            }

            if (_tooltip) {
                _localTooltip = d3.select(this.parentNode).select('.custom_tooltip');
            }

            outerRadius = Math.min(plotWidth, plotHeight) / 2.25;

            /* setting the outerradius of the arc */
            _arc.outerRadius(outerRadius);

            /* setting the innerradius and outerradius of the masking arc */
            _arcMask.outerRadius(outerRadius * 1.02)
                .innerRadius(outerRadius * 1.01);

            /* setting the outerradius and innerradius of the arc */
            _labelArc.outerRadius(outerRadius)
                .innerRadius(outerRadius * 0.8);

            var plot = container.append('g')
                .attr('id', 'pie-plot')
                .classed('plot', true)
                .attr('transform', function () {
                    var translate = [0, 0];
                    switch (_legendPosition) {
                        case 'top':
                            translate = [(plotWidth / 2), legendHeight + (plotHeight / 2)];
                            break;
                        case 'bottom':
                        case 'right':
                            translate = [(plotWidth / 2), (plotHeight / 2)];
                            break;
                        case 'left':
                            translate = [legendWidth + (plotWidth / 2), (plotHeight / 2)]
                    }

                    return 'translate(' + translate.toString() + ')';
                });

            _localKey = function (d) {
                return d.data[_dimension[0]];
            }

            var pieMask = plot.append('g')
                .attr('id', 'arc-mask-group')
                .selectAll('.arc-mask')
                .data(_pie(data), _localKey)
                .enter().append('g')
                .attr('id', function (d, i) {
                    return 'arc-mask-group-' + i;
                })
                .classed('arc-mask', true)
                .append('path')
                .attr('id', function (d, i) {
                    return 'arc-mask-path-' + i;
                })
                .attr('d', _arcMask)
                .style('visibility', 'hidden')
                .style('fill', function (d) {
                    return COMMON.COLORSCALE(d.data[_dimension[0]]);
                })
                .each(function (d) {
                    this._current = d;
                });

            var pieArcGroup = plot.append('g')
                .attr('id', 'arc-group')
                .selectAll('.arc')
                .data(_pie(data), _localKey)
                .enter().append('g')
                .attr('id', function (d, i) {
                    return 'arc-group-' + i;
                })
                .classed('arc', true);

            var pieArcPath = pieArcGroup.append('path')
                .attr('id', function (d, i) {
                    return 'arc-path-' + i;
                })
                .attr('fill', function (d) {
                    return COMMON.COLORSCALE(d.data[_dimension[0]]);
                })
                .style('fill', function (d) {
                    return COMMON.COLORSCALE(d.data[_dimension[0]]);
                })
                .each(function (d) {
                    this._current = d;
                })

            if (!_print) {
                pieArcPath.transition()
                    .duration(_durationFn())
                    .delay(_delayFn())
                    .attrTween('d', function (d) {
                        var i = d3.interpolate(d.startAngle + 0.1, d.endAngle);
                        return function (t) {
                            d.endAngle = i(t);
                            return _arc(d)
                        }
                    });
            }
            else {
                pieArcPath
                    .attr('d', _arc);
            }
            var pieLabel;

            if (_valueAsArc) {
                pieLabel = pieArcGroup.append('text')
                    .attr('dy', function (d, i) {
                        if (_valuePosition == 'inside') {
                            return 10;
                        } else {
                            return -5;
                        }
                    })

                var textPath = pieLabel.append('textPath')
                    .attr('xlink:href', function (d, i) {
                        return '#arc-path-' + i;
                    })
                    .attr('text-anchor', function () {
                        return 'middle';
                    })

                if (!_print) {
                    textPath.transition()
                        .delay(_delayFn(200))
                        .on('start', function () {
                            d3.select(this).attr('startOffset', function (d) {
                                var length = pieArcPath.nodes()[d.index].getTotalLength();
                                return 50 * (length - 2 * outerRadius) / length + '%';
                            })
                                .text(_labelFn())
                                .filter(function (d, i) {
                                    /* length of arc = angle in radians * radius */
                                    var diff = d.endAngle - d.startAngle;
                                    return outerRadius * diff < this.getComputedTextLength();
                                })
                                .remove();
                        });
                }
                else {
                    textPath.text(_labelFn())
                }
            } else {
                var pieArcTextGroup = plot.selectAll('.arc-text')
                    .data(_pie(data))
                    .enter().append('g')
                    .attr('id', function (d, i) {
                        return 'arc-text-group-' + i;
                    })
                    .classed('arc-text', true);

                pieLabel = pieArcTextGroup.append('text')
                    .attr('transform', function (d) {
                        var centroid = _labelArc.centroid(d),
                            x = centroid[0],
                            y = centroid[1],
                            h = _pythagorousTheorem(x, y);

                        if (_valuePosition == 'inside') {
                            return 'translate('
                                + outerRadius * (x / h) * 0.85
                                + ', '
                                + outerRadius * (y / h) * 0.85
                                + ')';
                        } else {
                            return 'translate('
                                + outerRadius * (x / h) * 1.05
                                + ', '
                                + outerRadius * (y / h) * 1.05
                                + ')';
                        }
                    })
                    .attr('dy', '0.35em')
                    .attr('text-anchor', function (d) {
                        if (_valuePosition == 'inside') {
                            return 'middle';
                        } else {
                            return (d.endAngle + d.startAngle) / 2 > Math.PI
                                ? 'end' : (d.endAngle + d.startAngle) / 2 < Math.PI
                                    ? 'start' : 'middle';
                        }
                    })

                if (!_print) {
                    pieLabel.transition()
                        .delay(_delayFn(200))
                        .on('start', function () {
                            d3.select(this).text(_labelFn())
                                .filter(function (d) {
                                    /* length of arc = angle in radians * radius */
                                    var diff = d.endAngle - d.startAngle;
                                    return outerRadius * diff < this.getComputedTextLength();
                                })
                                .remove();
                        });
                }
                else {
                    pieLabel.text(_labelFn())
                }
            }

            if (!_print) {

                var confirm = $(me).parent().find('div.confirm')
                    .css('visibility', 'hidden');

                var _filter = UTIL.createFilterElement()
                $(div).append(_filter);
                // Interaction only when print disabled
                pieArcPath.on('mouseover', _handleMouseOverFn.call(chart, _localTooltip, svg))
                    .on('mousemove', _handleMouseMoveFn.call(chart, _localTooltip, svg))
                    .on('mouseout', _handleMouseOutFn.call(chart, _localTooltip, svg))
                    .on('click', function (d, i) {
                        var confirm = d3.select(div).select('.confirm')
                            .style('visibility', 'visible');
                        filter = false;

                        var point = d3.select(this);
                        if (point.classed('selected')) {
                            point.classed('selected', false);
                        } else {
                            point.classed('selected', true);
                        }
                        var obj = new Object();
                        obj[chart.dimension()] = d.data[_dimension[0]]
                        obj[chart.measure()] = d.data[_measure[0]]
                        filterData.push(obj)

                        var _filterDimension = {};
                        if (broadcast.filterSelection.id) {
                            _filterDimension = broadcast.filterSelection.filter;
                        } else {
                            broadcast.filterSelection.id = $(div).attr('id');
                        }
                        var dimension = _dimension[0];
                        if (_filterDimension[dimension]) {
                            var temp = _filterDimension[dimension];
                            if (temp.indexOf(d.data[_dimension[0]]) < 0) {
                                temp.push(d.data[_dimension[0]]);
                            } else {
                                temp.splice(temp.indexOf(d.data[_dimension[0]]), 1);
                            }
                            _filterDimension[dimension] = temp;
                        } else {
                            _filterDimension[dimension] = [d.data[_dimension[0]]];
                        }

                        var idWidget = broadcast.updateWidget[$(div).attr('id')];
                        broadcast.updateWidget = {};
                        broadcast.updateWidget[$(div).attr('id')] = idWidget;
                        broadcast.filterSelection.filter = _filterDimension;
                        var _filterParameters = filterParameters.get();
                        _filterParameters[dimension] = _filterDimension[dimension];
                        filterParameters.save(_filterParameters);
                    });

                _localSVG.select('g.lasso').remove()

                d3.select(div).select('.filterData')
                    .on('click', applyFilter());

                d3.select(div).select('.removeFilter')
                    .on('click', clearFilter(div));

                var lasso = d3Lasso.lasso()
                    .hoverSelect(true)
                    .closePathSelect(true)
                    .closePathDistance(100)
                    .items(pieArcGroup)
                    .targetArea(_localSVG);

                lasso.on('start', onLassoStart(lasso, me))
                    .on('draw', onLassoDraw(lasso, me))
                    .on('end', onLassoEnd(lasso, me));

                _localSVG.call(lasso);
            }
        });
    }

    /**
     * Private method that delegates legend interactions to respective controllers
     *
     * @param {object} event Mouseevent instance
     * @param {object} datum Record of the data binded to the legend item
     * @return {undefined}
     */
    chart._legendInteraction = function (event, datum, plot) {
        if (_print) {
            // No interaction during print enabled
            return;
        }

        switch (event) {
            case 'mouseover':
                _legendMouseOver(datum, plot);
                break;
            case 'mousemove':
                _legendMouseMove(datum, plot);
                break;
            case 'mouseout':
                _legendMouseOut(datum, plot);
                break;
            case 'click':
                _legendClick(datum);
                break;
        }
    }

    chart._getName = function () {
        return _NAME;
    }

    chart._getHTML = function () {
        return _localSVG.node().outerHTML;
    }

    chart.update = function (data) {
        var svg = _localSVG,
            width = +svg.attr('width'),
            height = +svg.attr('height'),
            parentWidth = width - 2 * COMMON.PADDING,
            parentHeight = height - 2 * COMMON.PADDING,
            filteredData;

        /* store the data in local variable */
        _localData = data;
        filterData = [];

        data.sort(function (a, b) {
            return d3.ascending(a[_dimension[0]], b[_dimension[0]]);
        });

        filteredData = data.filter(function (d) {
            return _localLabelStack.indexOf(d[_dimension[0]]) == -1;
        });

        var prevData = svg.selectAll('g.arc')
            .data().map(function (d) { return d.data });

        svg.selectAll('.arc path').classed('selected', false)

        if (prevData.length == 0) {
            prevData = filteredData;
        }

        var oldFilteredData = _mergeForTransition(filteredData, prevData),
            newFilteredData = _mergeForTransition(prevData, filteredData);

        if (_legend) {
            svg.select('.legend').remove();

            _localLegend(data, svg.select('g'), {
                width: parentWidth,
                height: parentHeight,
                labelStack: _localLabelStack
            });
        }

        var outerRadius = Math.min(parentWidth, parentHeight) / 2.25;

        var pieMask = svg.select('#arc-mask-group')
            .selectAll('g.arc-mask')
            .data(_pie(oldFilteredData), _localKey)
            .enter()
            .insert('g')
            .attr('id', function (d, i) {
                return 'arc-mask-group-' + i;
            })
            .classed('arc-mask', true)
            .append('path')
            .attr('id', function (d, i) {
                return 'arc-mask-path-' + i;
            })
            .style('visibility', 'hidden')
            .style('fill', function (d) {
                return COMMON.COLORSCALE(d.data[_dimension[0]]);
            })
            .each(function (d) {
                this._current = d;
            });

        pieMask = svg.selectAll('g.arc-mask')
            .data(_pie(newFilteredData), _localKey)

        pieMask.select('path')
            .transition().duration(1000)
            .attrTween('d', function (d) {
                var interpolate = d3.interpolate(this._current, d);
                var _this = this;
                return function (t) {
                    _this._current = interpolate(t);
                    return _arcMask(_this._current);
                };
            });

        pieMask = svg.selectAll('g.arc-mask')
            .data(_pie(filteredData), _localKey);

        pieMask.exit()
            .transition()
            .delay(1000)
            .duration(0)
            .remove();

        var pieArcGroup = svg.select('#arc-group')
            .selectAll('g.arc')
            .data(_pie(oldFilteredData), _localKey)
            .enter()
            .insert('g')
            .attr('id', function (d, i) {
                return 'arc-group-' + i;
            })
            .classed('arc', true);

        var pieArcPath = pieArcGroup.append('path')
            .attr('id', function (d, i) {
                return 'arc-path-' + i;
            })
            .style('fill', function (d) {
                return COMMON.COLORSCALE(d.data[_dimension[0]]);
            })
            .each(function (d) {
                this._current = d;
            })

        if (!_print) {
            pieArcPath.on('mouseover', _handleMouseOverFn.call(chart, _localTooltip, svg))
                .on('mousemove', _handleMouseMoveFn.call(chart, _localTooltip, svg))
                .on('mouseout', _handleMouseOutFn.call(chart, _localTooltip, svg))
                .on('click', function (d, i) {
                    var confirm = d3.select(div).select('.confirm')
                        .style('visibility', 'visible');
                    filter = false;

                    var point = d3.select(this);
                    if (point.classed('selected')) {
                        point.classed('selected', false);
                    } else {
                        point.classed('selected', true);
                    }
                    var obj = new Object();
                    obj[chart.dimension()] = d.data[_dimension[0]]
                    obj[chart.measure()] = d.data[_measure[0]]
                    filterData.push(obj)

                    var _filterDimension = {};
                    if (broadcast.filterSelection.id) {
                        _filterDimension = broadcast.filterSelection.filter;
                    } else {
                        broadcast.filterSelection.id = $(div).attr('id');
                    }
                    var dimension = _dimension[0];
                    if (_filterDimension[dimension]) {
                        var temp = _filterDimension[dimension];
                        if (temp.indexOf(d.data[_dimension[0]]) < 0) {
                            temp.push(d.data[_dimension[0]]);
                        } else {
                            temp.splice(temp.indexOf(d.data[_dimension[0]]), 1);
                        }
                        _filterDimension[dimension] = temp;
                    } else {
                        _filterDimension[dimension] = [d.data[_dimension[0]]];
                    }

                    var idWidget = broadcast.updateWidget[$(div).attr('id')];
                    broadcast.updateWidget = {};
                    broadcast.updateWidget[$(div).attr('id')] = idWidget;
                    broadcast.filterSelection.filter = _filterDimension;
                    var _filterParameters = filterParameters.get();
                    _filterParameters[dimension] = _filterDimension[dimension];
                    filterParameters.save(_filterParameters);
                });
        }

        pieArcGroup = svg.selectAll('g.arc')
            .data(_pie(newFilteredData), _localKey);

        pieArcGroup.select('path')
            .transition().duration(1000)
            .attrTween('d', function (d) {
                var interpolate = d3.interpolate(this._current, d);
                var _this = this;
                return function (t) {
                    _this._current = interpolate(t);
                    return _arc(_this._current);
                };
            });

        pieArcGroup = svg.selectAll('g.arc')
            .data(_pie(filteredData), _localKey);

        pieArcGroup.exit()
            .transition()
            .delay(1000)
            .duration(0)
            .remove();

        if (_valueAsArc) {
            pieArcGroup.selectAll('text').remove()
            var pieLabel = pieArcGroup.append('text')
                .attr('dy', function (d, i) {
                    if (_valuePosition == 'inside') {
                        return 10;
                    } else {
                        return -5;
                    }
                })

            pieLabel.append('textPath')
                .attr('xlink:href', function (d, i) {
                    return '#arc-path-' + i;
                })
                .attr('text-anchor', function () {
                    return 'middle';
                })
                .text(_labelFn())
                .transition()
                .delay(_delayFn(2000))
                .on('start', function () {
                    d3.select(this).attr('startOffset', function (d) {

                        if (pieArcPath.nodes()[d.index] != undefined) {
                            var length = pieArcPath.nodes()[d.index].getTotalLength();
                            if (length == 0) {
                                return 10 + '%';
                            }
                            else {
                                return 50 * (length - 2 * outerRadius) / length + '%';
                            }
                        }
                        return 10 + '%';
                    })
                        .text(_labelFn())
                        .filter(function (d, i) {
                            /* length of arc = angle in radians * radius */
                            var diff = d.endAngle - d.startAngle;
                            return outerRadius * diff < this.getComputedTextLength();
                        })
                        .remove();
                });
        }
    }

    chart.config = function (value) {
        if (!arguments.length) {
            return _config;
        }
        _config = value;
        _setConfigParams.call(chart, _config);
        return chart;
    }

    chart.dimension = function (value) {
        if (!arguments.length) {
            return _dimension;
        }
        _dimension = value;
        return chart;
    }

    chart.measure = function (value) {
        if (!arguments.length) {
            return _measure;
        }
        _measure = value;
        _pie.value(function (d) { return d[_measure[0]]; });
        return chart;
    }

    chart.legend = function (value) {
        if (!arguments.length) {
            return _legend;
        }
        _legend = value;
        return chart;
    }

    chart.legendPosition = function (value) {
        if (!arguments.length) {
            return _legendPosition;
        }
        _legendPosition = value;
        return chart;
    }

    chart.valueAs = function (value) {
        if (!arguments.length) {
            return _valueAs;
        }
        _valueAs = value;
        return chart;
    }

    chart.valueAsArc = function (value) {
        if (!arguments.length) {
            return _valueAsArc;
        }
        _valueAsArc = value;
        return chart;
    }

    chart.valuePosition = function (value) {
        if (!arguments.length) {
            return _valuePosition;
        }
        _valuePosition = value;
        return chart;
    }

    chart.sort = function (value) {
        if (!arguments.length) {
            return _sort;
        }
        _sort = value;
        return chart;
    }

    chart.tooltip = function (value) {
        if (!arguments.length) {
            return _tooltip;
        }
        _tooltip = value;
        return chart;
    }

    chart.print = function (value) {
        if (!arguments.length) {
            return _print;
        }
        _print = value;
        return chart;
    }
    chart.broadcast = function (value) {
        if (!arguments.length) {
            return broadcast;
        }
        broadcast = value;
        return chart;
    }

    chart.filterParameters = function (value) {
        if (!arguments.length) {
            return filterParameters;
        }
        filterParameters = value;
        return chart;
    }

    return chart;
}

module.exports = pie;