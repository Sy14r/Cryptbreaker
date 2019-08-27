## ![Cryptbreaker Logo](CroppedCryptbreakerLogo.jpg)**Cryptbreaker** - A Cloud Based Password Cracking and Auditing Tool

Upload files and use AWS Spot Instances to crack passwords. Using cloud capabilities you can even prevent plaintext credentials from leaving the isolated cracking box ensuring that you get usable statistics on passwords while minimizing plaintext credential exposure.

![](initial-walkthrough.gif)

## Quick start
Clone repository:
```
git clone 
```
Install packages:
```
meteor npm install
```
Start Meteor:
```
meteor
```

Navigate to [http://localhost:3000](http://localhost:3000) in any browser.
Create an account via the `Signup` link at the top right and then complete installation by following the prompts.

## Longer Start
After completing the `Quick Start` steps above you will want to request service limit increases for EC2 Spot Limits for the `p3` class of machines so you can use them. Per Amazon:
> Spot Instance limits are dynamic. When your account is new, your limit might be lower than 20 to start, but can increase over time. In addition, your account might have limits on specific Spot Instance types. If you submit a Spot Instance request and you receive the error Max spot instance count exceeded, you can complete the AWS Support Center Create case form to request a Spot Instance limit increase. For Limit type, choose EC2 Spot Instances. For more information, see Amazon EC2 Service Limits.

As a result you'll want to sign into your AWS account. Click 'Support' in the top right and then 'Support Center'. Then click 'Create case' and choose 'Service limit Increase' then under 'Case Classification' choose the 'EC2 Spot Instances' limit type. For region choose each region one at a time and check if the instance type you want to add is available in that region (the instance types in use in **Cryptbreaker** are `p3.2xlarge`, `p3.8xlarge`, and `p3.16xlarge`). You can submit a single support case to increase your limits for each of these instane types in every availabilty zone that they appear in.

For the instance number you can just request an increase to any value greater than 0.

Provide a case description and submit your request. Once the limit is increased you should be good to use **Cryptbreaker** to perform cloud based cracking.


## Known Issues
#### Installation finalization steps says 'Update Failed - You are not subscribed to this service
If you haven't used AWS a lot before and you've just created a new account you'll have to make sure you also sign into the AWS console and navigate to Services -> EC2 to complete initial registration and even then you may need to wait up to 24 hours before it will succeed.



## Project started with template from:
https://github.com/johnwils/meteor-react-template.git