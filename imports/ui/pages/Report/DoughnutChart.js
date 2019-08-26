import Chart from 'chart.js';
import React from 'react';

import './Report.scss';

class DoughnutChart extends React.Component {
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
          type: 'doughnut',
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

  export default DoughnutChart;