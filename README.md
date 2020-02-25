## ![Cryptbreaker Logo](CroppedCryptbreakerLogo.jpg)**Cryptbreaker** - A Cloud Based Password Cracking and Auditing Tool

Upload files and use AWS Spot Instances to crack passwords. Using cloud capabilities you can even prevent plaintext credentials from leaving the isolated cracking box ensuring that you get usable statistics on passwords while minimizing plaintext credential exposure.

![](initial-walkthrough.gif)

## Quick start
1. Install Docker
2. Run Cryptbreaker
```
docker run -p 3000:3000 sy14r/cryptbreaker
```

Navigate to [http://localhost:3000](http://localhost:3000) in any browser.
Create an account via the `Signup` link at the top right and then complete installation by following the prompts.

## Longer Start
After completing the `Quick Start` steps above you will want to request service limit increases for EC2 Spot Limits for the `p3` class of machines so you can use them. Per Amazon:
> Spot Instance limits are dynamic. When your account is new, your limit might be lower than 20 to start, but can increase over time. In addition, your account might have limits on specific Spot Instance types. If you submit a Spot Instance request and you receive the error Max spot instance count exceeded, you can complete the AWS Support Center Create case form to request a Spot Instance limit increase. For Limit type, choose EC2 Spot Instances. For more information, see Amazon EC2 Service Limits.

As a result you'll want to sign into your AWS account and submit a support case to increase you spot limits. 
[Checkout the instructions on the wiki here](https://github.com/Sy14r/Cryptbreaker/wiki/Spot-Limit-Increase-Walkthrough)
 Once the limit is increased you should be good to use **Cryptbreaker** to perform cloud based cracking.


## Known Issues
#### Installation finalization steps says 'Update Failed - You are not subscribed to this service
If you haven't used AWS a lot before and you've just created a new account you'll have to make sure you also sign into the AWS console and navigate to Services -> EC2 to complete initial registration and even then you may need to wait up to 24 hours before it will succeed.



## Project started with template from:
https://github.com/johnwils/meteor-react-template.git
