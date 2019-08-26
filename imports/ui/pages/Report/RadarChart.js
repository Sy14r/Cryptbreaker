import Chart from 'chart.js';
import React from 'react';

import './Report.scss';

class RadarChart extends React.Component {
    constructor(props) {
      super(props);
      this.chartRef = React.createRef();
    }

    componentDidUpdate() {
        this.myChart.data.labels = this.props.data.map(d => d.label);
        this.myChart.data.datasets[0].data = this.props.data.map(d => d.value);
        this.myChart.update();
      }

    componentDidMount() {
        let options = {
          type: 'pie',
          data: {
          labels: this.props.data.map(d => d.label),
          datasets: [{
              label: this.props.title,
              data: this.props.data.map(d => d.value),
              backgroundColor: this.props.colors
          }]
          },
          options:{
            legend:{
              position:'bottom',
              display:true
            },
            title:{
              display:true,
              text:this.props.title,
            },
            circumference: 2 * Math.PI,
            rotation: -0.5 * Math.PI,
            tooltips: {
              mode: 'dataset',
               // Disable the on-canvas tooltip
            // enabled: false,

            // custom: function(tooltipModel) {
            //     // Tooltip Element
            //     var tooltipEl = document.getElementById('chartjs-tooltip');

            //     // Create element on first render
            //     if (!tooltipEl) {
            //         tooltipEl = document.createElement('div');
            //         tooltipEl.id = 'chartjs-tooltip';
            //         tooltipEl.innerHTML = '<table></table>';
            //         document.body.appendChild(tooltipEl);
            //     }

            //     // Hide if no tooltip
            //     if (tooltipModel.opacity === 0) {
            //         tooltipEl.style.opacity = 0;
            //         return;
            //     }

            //     // Set caret Position
            //     tooltipEl.classList.remove('above', 'below', 'no-transform');
            //     if (tooltipModel.yAlign) {
            //         tooltipEl.classList.add(tooltipModel.yAlign);
            //     } else {
            //         tooltipEl.classList.add('no-transform');
            //     }

            //     function getBody(bodyItem) {
            //         return bodyItem.lines;
            //     }

            //     // Set Text
            //     if (tooltipModel.body) {
            //         var titleLines = tooltipModel.title || [];
            //         var bodyLines = tooltipModel.body.map(getBody);

            //         var innerHtml = '<thead>';

            //         titleLines.forEach(function(title) {
            //             innerHtml += '<tr><th>' + title + '</th></tr>';
            //         });
            //         innerHtml += '</thead><tbody>';

            //         bodyLines.forEach(function(body, i) {
            //             var colors = tooltipModel.labelColors[i];
            //             var style = 'background:' + colors.backgroundColor;
            //             style += '; border-color:' + colors.borderColor;
            //             style += '; border-width: 2px';
            //             var span = '<span style="' + style + '"></span>';
            //             innerHtml += '<tr><td>' + span + body + '</td></tr>';
            //         });
            //         innerHtml += '</tbody>';

            //         var tableRoot = tooltipEl.querySelector('table');
            //         tableRoot.innerHTML = innerHtml;
            //     }

            //     // `this` will be the overall tooltip
            //     var position = this._chart.canvas.getBoundingClientRect();

            //     // Display, position, and set styles for font
            //     tooltipEl.style.opacity = 1;
            //     tooltipEl.style.position = 'absolute';
            //     tooltipEl.style.backgroundColor = tooltipModel.backgroundColor;
            //     tooltipEl.style.bodyFontColor = tooltipModel.bodyFontColor;
            //     tooltipEl.style.color = tooltipModel.bodyFontColor;
            //     tooltipEl.style.borderRadius = `${tooltipModel.cornerRadius}`;
            //     tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
            //     tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
            //     tooltipEl.style.fontFamily = tooltipModel._bodyFontFamily;
            //     tooltipEl.style.fontSize = tooltipModel.bodyFontSize + 'px';
            //     tooltipEl.style.fontStyle = tooltipModel._bodyFontStyle;
            //     tooltipEl.style.padding = tooltipModel.yPadding + 'px ' + tooltipModel.xPadding + 'px';
            //     tooltipEl.style.pointerEvents = 'none';

            //     console.log(tooltipModel)
            //     console.log(tooltipEl)
            // }
           },
      
          }
        }
        if(this.props.semiCircle){
          options.options.rotation = 1 * Math.PI,
          options.options.circumference = 1 * Math.PI
        }
        if(this.props.hideLegend){
          options.options.legend.display = false
        }
        if(this.props.legendPosition){
          options.options.legend.position = this.props.legendPosition
        }
        Chart.Tooltip.positioners.custom = function(elements, eventPosition) {
          /** @type {Chart.Tooltip} */
          var tooltip = this;
      
          /* ... */
      
          return {
              x: 0,
              y: 0
          };
      };
      
        this.myChart = new Chart(this.chartRef.current, options);
    }
  
    render() {
      // console.log(this.props.data)
      return (
          <>
            {this.props.className ? 
            (
              <div className={this.props.className}>
                <canvas ref={this.chartRef} />
              </div>
            ) : 
            (
              <div className="ChartCard">
                <canvas ref={this.chartRef} />
              </div>
            )}
          </>
          
      );
    }
  }

  export default RadarChart;