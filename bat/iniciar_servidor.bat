@echo off
set DB_PASSWORD=admin
set DB_URL=jdbc:postgresql://localhost:5433/proyectoanalisis?currentSchema=ProyectoAnalisis
set DB_USER=postgres
set JWT_EXP=3600000
set JWT_SECRET=test
set PORT=8080

mvnw spring-boot:run
