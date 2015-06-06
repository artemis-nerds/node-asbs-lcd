# node-asbs-lcd
Displays information about an Artemis SBS game on a I2C LCD 16x2 characters display.


Still in a quite experimental stage, so expect rough edges.



## Requirements

* A computer with an i2c interface in easy reach (a Raspberry Pi is a very good choice)
* A 16x2 LCD display with a 1602 microcontroller provinding the i2c interface
* Having read the documentation about how to enable i2c in a Raspberry Pi
* Being aware that a mistake in connecting the i2c devices can result in damage to your hardware if you are not careful
* Knowing how to detect the i2c bus and the device address of an i2c device


## Installation

Clone the repo and `npm install`. In a low power computer, the whole process can take around 15 minutes.

## Running

Run `js index.js --help` to display available options.


## Legalese

"THE BEER-WARE LICENSE":
<ivan@sanchezortega.es> wrote this file. As long as you retain this notice you
can do whatever you want with this stuff. If we meet some day, and you think
this stuff is worth it, you can buy me a beer in return.





