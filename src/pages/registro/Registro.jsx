// src/components/Registro/Registro.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import "./Registro.css";
import PersonalDetails from "./PersonalDetails";
import Social from "./Social";
import CompanyDetails from "./CompanyDetails";
import Summary from "./Summary";
import Account from "./Account";

const steps = [
  "Información de Contacto",
  "Redes Sociales",
  "Información Adicional",
  "Datos del Usuario",
  "Resumen",
];

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    personType: "",
    companyName: "",
    ruc: "",
    phoneNumber: "",
    email: "",
    sunarpRegistration: "",
    mvcsAgentNumber: "",
    descripcion: "",
    portfolioLink: "",
    fiscalAddress: "",
    officeAddress: "",
  });

  const handleNextStep = (data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep((prev) => prev + 1);
  };

  const handlePreviousStep = () => setCurrentStep((prev) => prev - 1);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalDetails onNext={handleNextStep} formData={formData} />;
      case 2:
        return (
          <Social
            onNext={handleNextStep}
            onBack={handlePreviousStep}
            formData={formData}
          />
        );
      case 3:
        return (
          <CompanyDetails
            onNext={handleNextStep}
            onBack={handlePreviousStep}
            formData={formData}
          />
        );
      case 4:
        return (
          <Account
            onNext={handleNextStep}
            onBack={handlePreviousStep}
            formData={formData}
          />
        );
      case 5:
        return <Summary onBack={handlePreviousStep} formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <div className="register-container">
      <div className="outside-links-container">
        <Link to="/login" className="outside-link-btn left">
          ¿Tienes cuenta?
        </Link>
        <Link to="/" className="outside-link-btn right">
          ¿Interesado en lotes?
        </Link>
      </div>
      <Motion.div
        className="form-wrapper"
        layout
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        {/* Sidebar */}
        <div className="steps-sidebar">
          <h2>Registro</h2>
          {steps.map((step, i) => (
            <div
              key={i}
              className={`step ${currentStep >= i + 1 ? "active" : ""}`}
            >
              <div className="step-circle">{i + 1}</div>
              <div className="step-text">{step}</div>
            </div>
          ))}
        </div>

        {/* Contenido con animación */}
        <div className="form-content">
          <h2 className="form-title">Registro de Inmobiliaria</h2>
          <AnimatePresence mode="wait">
            <Motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 40, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: -40, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              style={{ width: "100%" }}
            >
              {renderStep()}
            </Motion.div>
          </AnimatePresence>
        </div>
      </Motion.div>
    </div>
  );
};

export default Register;
