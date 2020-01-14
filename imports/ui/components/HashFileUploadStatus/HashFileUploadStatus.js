import { Meteor } from 'meteor/meteor';
import React from 'react';
import PropTypes from 'prop-types';

import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
 

import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

import LinearProgress from '@material-ui/core/LinearProgress';

const MySwal = withReactContent(Swal);
let firedToasts = []
let toastsArray = []
const HashFileUploadStatus = ({ hashUploadJobs }) => {
    return(
        <>
        {_.each(hashUploadJobs, (hashUploadJob) => {
            // console.log(hashUploadJob)
            if(!firedToasts.includes(hashUploadJob._id)) {
                // New Toast Logic Here
                // let newSwal = MySwal.fire({
                //     toast:true,
                //     type:'info',
                //     animation:false,
                //     position:'top-right',
                //     uploadID:hashUploadJob._id,
                //     html: <><p>{hashUploadJob.name}</p><LinearProgress className={`linearProgressValue-${hashUploadJob._id}`} variant="determinate" value={hashUploadJob.uploadStatus}/></>
                // })
                // if(toastId === null){
                //     toastId = toast('Upload in Progress', {
                //     progress: progress
                //   });
                // } else {
                //   toast.update(toastId, {
                //     progress: progress
                //   })
                // }
                if(hashUploadJob.uploadStatus >= 0 && hashUploadJob.uploadStatus < 100){
                    let newSwal = toast(<><p className={`textFor-${hashUploadJob._id}`}>{hashUploadJob.name} - {hashUploadJob.description}</p><LinearProgress className={`linearProgressValue-${hashUploadJob._id}`} variant="determinate" value={hashUploadJob.uploadStatus}/></>,{
                        position: "top-center",
                        autoClose: false,
                        hideProgressBar: true,
                        closeOnClick: false,
                        pauseOnHover: false,
                        draggable: false,
                    });
                    // console.log(hashUploadJob)
                    firedToasts.push(hashUploadJob._id);
                    toastsArray.push({hashUploadID:hashUploadJob._id,toastID:newSwal})
                } 
            }
            else {
                // _.each(toastsArray, (firedToasts) => {
                    // if(typeof firedSwal.params !== 'undefined'){
                        // console.log(firedToasts)
                        // if(firedSwal.params.uploadID === hashUploadJob._id){
                        //     // console.log(`Updating - ${hashUploadJob.uploadStatus}`)
                            let status = $(`.linearProgressValue-${hashUploadJob._id}`);
                            let elem = status.children()[0]
                            // // console.log(elem)
                            // // console.log(100-hashUploadJob.uploadStatus)
                            if(typeof elem !== 'undefined'){
                                elem.setAttribute('style',`transform:translateX(-${Math.trunc(100-hashUploadJob.uploadStatus)}%);`)
                            }
                            let text = $(`.textFor-${hashUploadJob._id}`);
                            // console.log(text)
                            elem = text[0]
                            // console.log(elem)
                            // // console.log(100-hashUploadJob.uploadStatus)
                            if(typeof elem !== 'undefined'){
                                elem.innerHTML = `${hashUploadJob.name} - ${hashUploadJob.description}`
                            }
                            if (hashUploadJob.uploadStatus >= 100){
                                // Find the toastID
                                _.each(toastsArray, (toastObj) => {
                                    if(toastObj.hashUploadID === hashUploadJob._id){
                                        toast.update(toastObj.toastID, {
                                            autoClose: 1000
                                        })
                                    }
                                })
                            }
                            // elem.css({'transform':'translateX(-'+(100-hashUploadJob.uploadStatus)+'%)'})
                            // $status.html("I'm an update");
                            // firedSwal.params.footer = <LinearProgress className={{"linearProgressValue"}} style={{width:"100%"}} variant="determinate" value={hashUploadJob.uploadStatus}/>
                            // // firedSwal.params.html.props.children[0].props.value = hashUploadJob.uploadStatus
                        // }
                    // }
                // })
                // let swalToUpdate = _.find(swalsArray,['params.uploadID',hashUploadJob._id])
                // console.log(swalToUpdate)
            }
        })}
        </>
  )};
  
  HashFileUploadStatus.propTypes = {
    hashUploadJobs: PropTypes.array.isRequired,
  };
  
  export default HashFileUploadStatus;

