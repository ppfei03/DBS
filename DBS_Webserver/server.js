server {
    listen 443 ssl;
    server_name api.philipppfeiffer.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        add_header Access-Control-Allow-Origin "https://dbs.philipppfeiffer.de";
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        add_header Access-Control-Allow-Credentials "true";

        # Optional: OPTIONS-Anfragen ohne Weiterleitung beantworten
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    ssl_certificate /etc/letsencrypt/live/api.philipppfeiffer.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.philipppfeiffer.de/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name api.philipppfeiffer.de;

    return 301 https://$host$request_uri;
}
