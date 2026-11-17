# Official nginx 1.30.6 Alpine image, pinned to the resolved registry digest.
ARG NGINX_IMAGE=nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
FROM ${NGINX_IMAGE}

COPY deploy/nginx.conf /etc/nginx/nginx.conf
USER nginx:nginx
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
