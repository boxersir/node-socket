FROM node

ENV TZ=Asia/Shanghai

COPY ./ /data/

WORKDIR /data

RUN ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

#CMD ["npm run serve"]
