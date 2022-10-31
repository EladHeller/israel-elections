npm run build && \
cp ./package.json ./dist/package.json  && \
cd ./dist && \
npm --quiet i --only=prod && \
rm -rf ./__tests__ ./package-lock.json && \
cd - && \
rm -f dist.zip && \
zip -rq9 dist.zip ./dist && \
rm -f client.zip && \
zip -rq9 client.zip ./elections-client && \
npm run update-s3 && \
npm run clear-cache && \
echo finnish deploy!