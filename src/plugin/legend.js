const Util = require('../util/common');
const DomUtil = require('../util/dom');
const { Legend } = require('../component/index');
const Global = require('../global');
const LEGEND_OFFSET = 24;
const LEGEND_GAP = 24;
const MARKER_SIZE = 4.5;

// Register the default configuration for Legend
Global.legend = Util.deepMix(Global.Legend || {}, {
  right: {
    position: 'right',
    layout: 'vertical',
    itemMarginBottom: 8,
    title: null,
    textStyle: {
      fill: '#8C8C8C',
      fontSize: 12,
      textAlign: 'start',
      textBaseline: 'middle',
      lineHeight: 20
    }, // 图例项文本的样式
    unCheckColor: '#bfbfbf'
  },
  left: {
    position: 'left',
    layout: 'vertical',
    itemMarginBottom: 8,
    title: null,
    textStyle: {
      fill: '#8C8C8C',
      fontSize: 12,
      textAlign: 'start',
      textBaseline: 'middle',
      lineHeight: 20
    }, // 图例项文本的样式
    unCheckColor: '#bfbfbf'
  },
  top: {
    position: 'top',
    layout: 'horizontal',
    title: null,
    itemGap: 10,
    textStyle: {
      fill: '#8C8C8C',
      fontSize: 12,
      textAlign: 'start',
      textBaseline: 'middle',
      lineHeight: 20
    }, // 图例项文本的样式
    unCheckColor: '#bfbfbf'
  },
  bottom: {
    position: 'bottom',
    layout: 'horizontal',
    title: null,
    itemGap: 24,
    textStyle: {
      fill: '#8C8C8C',
      fontSize: 12,
      textAlign: 'start',
      textBaseline: 'middle',
      lineHeight: 20
    }, // 图例项文本的样式
    unCheckColor: '#bfbfbf'
  }
});

function _isScaleExist(scales, compareScale) {
  let flag = false;
  Util.each(scales, scale => {
    const scaleValues = [].concat(scale.values);
    const compareScaleValues = [].concat(compareScale.values);
    if (scale.type === compareScale.type && scale.field === compareScale.field && scaleValues.sort().toString() === compareScaleValues.sort().toString()) {
      flag = true;
      return;
    }
  });

  return flag;
}

class LegendController {
  constructor(cfg) {
    this.legendCfg = {};
    this.enable = true;
    this.position = 'top';
    Util.mix(this, cfg);
    this.clear();
  }

  addLegend(scale, attr, filterVals) {
    const self = this;
    const legendCfg = self.legendCfg;
    const field = scale.field;
    const fieldCfg = legendCfg[field];

    if (fieldCfg === false) { // 如果不显示此图例
      return null;
    }

    if (fieldCfg && fieldCfg.custom) { // 自定义图例逻辑
      self.addCustomLegend(field);
    } else {
      let position = legendCfg.position || self.position;
      if (fieldCfg && fieldCfg.position) { // 如果对某个图例单独设置 position，则以该 position 为准
        position = fieldCfg.position;
      }
      if (scale.isCategory) { // 目前只支持分类
        self._addCategroyLegend(scale, attr, position, filterVals);
      }
    }
  }

  addCustomLegend(field) {
    const self = this;

    let legendCfg = self.legendCfg;
    if (field && legendCfg[field]) {
      legendCfg = legendCfg[field];
    }

    const position = legendCfg.position || self.position;
    const legends = self.legends;
    legends[position] = legends[position] || [];
    const items = legendCfg.items;
    if (!items) {
      return null;
    }

    const container = self.container;
    Util.each(items, item => {
      if (!Util.isObject(item.marker)) {
        item.marker = {
          symbol: item.marker || 'circle',
          fill: item.fill,
          radius: MARKER_SIZE
        };
      } else {
        item.marker.radius = item.marker.radius || MARKER_SIZE;
      }
      item.checked = Util.isNil(item.checked) ? true : item.checked;
    });

    const legend = new Legend.Category(Util.deepMix({}, Global.legend[position], legendCfg, {
      maxLength: self._getMaxLength(position),
      items
    }));
    container.add(legend.container);
    legends[position].push(legend);
  }

  clear() {
    const legends = this.legends;
    Util.each(legends, legendItems => {
      Util.each(legendItems, legend => {
        legend.clear();
      });
    });

    this.legends = {};
    this.unBindEvents();
  }

  _isFiltered(scale, values, value) {
    let rst = false;
    value = scale.invert(value);
    Util.each(values, val => {
      rst = rst || scale.getText(val) === scale.getText(value);
      if (rst) {
        return false;
      }
    });
    return rst;
  }

  _getMaxLength(position) {
    const plotRange = this.plotRange;
    return (position === 'right' || position === 'left') ? plotRange.bl.y - plotRange.tr.y : plotRange.br.x - plotRange.bl.x;
  }

  _addCategroyLegend(scale, attr, position, filterVals) {
    const self = this;
    const { legendCfg, legends, container } = self;
    const items = [];
    const field = scale.field;
    const ticks = scale.getTicks();
    legends[position] = legends[position] || [];

    let symbol = 'circle';
    if (legendCfg[field] && legendCfg[field].marker) { // 用户为 field 对应的图例定义了 marker
      symbol = legendCfg[field].marker;
    } else if (legendCfg.marker) {
      symbol = legendCfg.marker;
    }

    Util.each(ticks, tick => {
      const text = tick.text;
      const name = text;
      const scaleValue = tick.value;
      const value = scale.invert(scaleValue);
      const color = attr.mapping(value).join('') || Global.defaultColor;

      const marker = {
        symbol,
        fill: color,
        radius: 5
      };

      items.push({
        value: name, // 图例项显示文本的内容
        dataValue: value, // 图例项对应原始数据中的数值
        checked: filterVals ? self._isFiltered(scale, filterVals, scaleValue) : true,
        marker
      });
    });

    const lastCfg = Util.deepMix({}, Global.legend[position], legendCfg[field] || legendCfg, {
      maxLength: self._getMaxLength(position),
      items,
      field,
      filterVals
    });
    if (lastCfg.title) {
      Util.deepMix(lastCfg, {
        title: {
          text: scale.alias || scale.field
        }
      });
    }

    const legend = new Legend.Category(lastCfg);
    container.add(legend.container);
    legends[position].push(legend);
    return legend;
  }

  _alignLegend(legend, pre, position) {
    const self = this;
    const plotRange = self.plotRange;
    const offsetX = legend.offsetX || 0;
    const offsetY = legend.offsetY || 0;

    let x = 0;
    let y = 0;
    if (position === 'left' || position === 'right') { // position 为 left、right，图例整体居中对齐
      const legendHeight = legend.getHeight();
      const height = Math.abs(plotRange.tl.y - plotRange.bl.y);
      x = (position === 'left') ? LEGEND_OFFSET : (plotRange.br.x + LEGEND_OFFSET);
      y = (height - legendHeight) / 2 + plotRange.tl.y;
      if (pre) {
        y = pre.get('y') - legendHeight - LEGEND_GAP;
      }
    } else { // position 为 top、bottom，图例整体居左对齐
      x = plotRange.tl.x;
      y = (position === 'top') ? LEGEND_OFFSET : (plotRange.bl.y + LEGEND_OFFSET * 2); // TODO

      if (pre) {
        const preWidth = pre.getWidth();
        x = pre.x + preWidth + LEGEND_GAP;
      }
    }
    legend.moveTo(x + offsetX, y + offsetY);
  }

  alignLegends() {
    const self = this;
    const legends = self.legends;
    Util.each(legends, (legendItems, position) => {
      Util.each(legendItems, (legend, index) => {
        const pre = legendItems[index - 1];
        self._alignLegend(legend, pre, position);
      });
    });

    return self;
  }

  handleEvent(ev) {
    const self = this;

    function findItem(x, y) {
      let result = null;
      const legends = self.legends;
      Util.each(legends, legendItems => {
        Util.each(legendItems, legend => {
          const { itemsGroup, legendHitBoxes } = legend;
          const children = itemsGroup.get('children');
          if (children.length) {
            const legendPosX = legend.x;
            const legendPosY = legend.y;
            Util.each(legendHitBoxes, (box, index) => {
              if (x >= (box.x + legendPosX) && x <= (box.x + box.width + legendPosX) && y >= (box.y + legendPosY) && y <= (box.height + box.y + legendPosY)) { // inbox
                result = {
                  clickedItem: children[index],
                  clickedLegend: legend
                };
                return false;
              }
            });
          }
        });
      });
      return result;
    }

    const chart = self.chart;
    const { x, y } = DomUtil.createEvent(ev, chart);
    const clicked = findItem(x, y);
    if (clicked && clicked.clickedLegend.clickable !== false) {
      const { clickedItem, clickedLegend } = clicked;
      if (clickedLegend.onClick) {
        ev.clickedItem = clickedItem;
        clickedLegend.onClick(ev);
      } else if (!clickedLegend.custom) {
        const filterVals = clickedLegend.filterVals;
        const field = clickedLegend.field;
        const checked = clickedItem.get('checked');
        const value = clickedItem.get('dataValue');
        if (!checked) {
          filterVals.push(value);
        } else {
          Util.Array.remove(filterVals, value);
        }
        chart.filter(field, val => {
          return filterVals.indexOf(val) !== -1;
        });
        chart.repaint();
      }
    }
  }

  bindEvents() {
    const chart = this.chart;
    const legendCfg = this.legendCfg;
    const triggerOn = legendCfg.triggerOn || 'click';
    const method = Util.wrapBehavior(this, 'handleEvent');
    if (Util.isFunction(triggerOn)) {
      triggerOn(method, 'bind');
    } else {
      DomUtil.addEventListener(chart, triggerOn, method);
    }
  }

  unBindEvents() {
    const chart = this.chart;
    const legendCfg = this.legendCfg;
    const triggerOn = legendCfg.triggerOn || 'click';
    const method = Util.getWrapBehavior(this, 'handleEvent');
    if (Util.isFunction(triggerOn)) {
      triggerOn(method, 'unBind');
    } else {
      DomUtil.removeEventListener(chart, triggerOn, method);
    }
  }
}
module.exports = {
  init(chart) {
    const legendController = new LegendController({
      container: chart.get('backPlot'),
      plotRange: chart.get('plot'),
      chart
    });
    chart.set('legendController', legendController);
  },
  afterGeomDraw(chart) {
    const legendController = chart.get('legendController');
    if (!legendController.enable) return null; // legend is not displayed

    const geoms = chart.get('geoms');
    const legendCfg = legendController.legendCfg;
    const scales = [];

    if (legendCfg && legendCfg.custom) { // 用户自定义图例
      legendController.addCustomLegend();
    } else {
      Util.each(geoms, geom => {
        const colorAttr = geom.getAttr('color');
        if (colorAttr) {
          const type = colorAttr.type;
          const scale = colorAttr.getScale(type);
          if (scale.type !== 'identity' && !_isScaleExist(scales, scale)) {
            scales.push(scale);
            // Get filtered values
            const { field, values } = scale;
            const filters = chart.get('filters');
            let filterVals;
            if (filters && filters[field]) {
              filterVals = values.filter(filters[field]);
            } else {
              filterVals = values.slice(0);
            }
            legendController.addLegend(scale, colorAttr, filterVals);
          }
        }
      });
    }

    legendController.alignLegends(); // adjust position

    if (legendCfg && legendCfg.clickable !== false) {
      legendController.bindEvents();
    }
  },
  clearInner(chart) {
    const legendController = chart.get('legendController');
    legendController.clear();
  }
};
