import Chart from 'chart.js';
import React from 'react';

import './Report.scss';

class LineChart extends React.Component {
    constructor(props) {
      super(props);
      this.chartRef = React.createRef();
    }


    componentDidMount() {
        // console.log(this.props)
        this.myChart = new Chart(this.chartRef.current, {
            type: this.props.type,
            data: {
              labels: this.props.data.map(d => d.label),
              datasets: [{
                data: this.props.data.map(d => d.value),
                backgroundColor: this.props.color
              }]
            },
            options: {
              legend:{
                display:false
              },
              title:{
                display:true,
                text:this.props.title,
              },
              scales: {
                yAxes: [{
                  minBarLength:2,
                  type:'linear',
                  ticks: {
                    min:0,
                    max:this.props.max,
                    display:true,
                  },
                  gridLines:{
                    display:false
                  },
                  scaleLabel:{
                    labelString:"Count",
                    display:true
                  }    
                }],
                xAxes:[{
                  scaleLabel:{
                    labelString:this.props.xLabel,
                    display:true,
                  }
                }]
              }
            }          
          });
      }
  
    render() {
      return (
          <div className="ChartCard">
            <canvas ref={this.chartRef} />
          </div>
      );
    }
  }

  export default LineChart;