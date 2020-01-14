import Chart from 'chart.js';
import React from 'react';

import './Report.scss';

class ChartItem extends React.Component {
    constructor(props) {
      super(props);
      this.chartRef = React.createRef();
    }

    componentDidMount() {
      // console.log(this.props.data)
      let theLabels = this.props.data.map(d => d.label)
      let theData = this.props.data.map(d => d.count)
      let theColor = this.props.data.map(d => this.props.color)
      // console.log(theLabels)
      // console.log(theData)
      // console.log(theColor)
      // console.log(this.props)
      this.myChart = new Chart(this.chartRef.current, {
          type: 'horizontalBar',
          data: {
            labels: theLabels,
            datasets: [{
              label:"Hash Frequency",
              data: theData,
              backgroundColor: theColor,
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
              // yAxes: [{
              //   type:'linear',
              //   ticks: {
              //     min:0,
              //     max:this.props.max,
              //     display:true,
              //   },
              //   gridLines:{
              //     display:false
              //   },
              //   scaleLabel:{
              //     labelString:"Number of Observations",
              //     display:false
              //   }    
              // }],
              xAxes:[{
                ticks:{min:0},
                // scaleLabel:{
                //   labelString:"Password Length",
                //   display:false
                }]
              }
            }      
        });
    }
  
    render() {
      return (
        <>
          {this.props.className ? (
            <div className={this.props.className}>
              <canvas ref={this.chartRef} />
          </div>
          ) : (
            <div className="ChartCard">
              <canvas ref={this.chartRef} />
            </div>
          ) }
        </>
          
      );
    }
  }

  export default ChartItem;