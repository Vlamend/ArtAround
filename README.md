# ArtAround
Progetto tech web per l'anno 25/26

--Descrizione docker--

This is the docker console for sites in the tw.cs.unibo.it cluster.

To activate an image, type 'start <technology> <sitename> [<script>]'.

Available images are:
* static (no server-side scripting)
* node-22 (node 22, current on December 2024, recommended for TW A.Y. 2024-25 - Vitali)
* node-20 (node 20.0.0, current on May 2023, recommended for TW A.Y. 2022-23 - Vitali)
* nodemon-22 (nodemon 22, current on December 2024, recommended for TW A.Y. 2024-25 - Vitali)
* nodemon-20 (nodemon 2.0.22, current on May 2023, recommended for TW A.Y. 2022-23 - Vitali)
* php7 (Apache + PHP7)
* mongo (mongodb current on December 2024, recommended for TW A.Y. 2024-25 - Vitali)
* mongo-5 (mongodb 5 current on May 2023, recommended for TW A.Y. 2022-23 - Vitali)

Please take note:
- <site> is the string 'siteYYYYNN' or 'username' that you received when registering for web services.
- All scripts and necessary files must be placed under the path /home/web/<site>/html/ .
- <script> is only required for node images.
- Node and nodemon scripts must bind to port 8000, but the site will be available at http(s)://<site>.tw.cs.unibo.it/ (no port).
- The mongodb instance can be reached only from inside the tw.cs.unibo.it cluster (e.g. by a node docker)
- Error logs and console logs can be found here typing logs <site> or as files under the path /home/web/<site>/log/ .

To exit this console, type 'exit'.
To restart any of the sites, type 'restart <image> <site>'.
To get additional help and the full list of accepted commands, type 'help'.

--------------------------------------------------

