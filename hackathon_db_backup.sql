-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: hackathon_db
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.4

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `po_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `audit_status` enum('CLEAR','DISCREPANCY') NOT NULL,
  `discrepancy_reason` text,
  `expected_quantity` decimal(12,2) NOT NULL,
  `delivered_quantity` decimal(12,2) NOT NULL,
  `quantity_variance` decimal(12,2) NOT NULL,
  `agreed_unit_price` decimal(12,2) NOT NULL,
  `charged_unit_price` decimal(12,2) NOT NULL,
  `price_variance` decimal(12,2) NOT NULL,
  `financial_exposure` decimal(14,2) NOT NULL DEFAULT '0.00',
  `risk_score` decimal(5,2) DEFAULT NULL,
  `audited_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_invoice` (`invoice_id`),
  KEY `idx_audit_po` (`po_id`),
  KEY `idx_audit_vendor` (`vendor_id`),
  KEY `idx_audit_status` (`audit_status`),
  KEY `idx_audit_date` (`audited_at`),
  CONSTRAINT `fk_audit_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`),
  CONSTRAINT `fk_audit_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `fk_audit_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `buyers`
--

DROP TABLE IF EXISTS `buyers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `buyers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('active','pending','blocked') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `buyers`
--

LOCK TABLES `buyers` WRITE;
/*!40000 ALTER TABLE `buyers` DISABLE KEYS */;
INSERT INTO `buyers` VALUES (2,'Demo Buyer','buyer@demo.com','9876543210','$2b$12$fZYnQTEd9UaltQY/7XL6OuVnuo0i42Zydt1UVOurXefVxTZPnqUCC','active','2026-09-12 08:17:57'),(3,'Test Buyer','buyer-test-2026@example.com','9876543210','$2b$12$hBqpeAMTng1z5cGCSam./eKnmgt.B3tltpUht7SDP52e.NZbrSj4m','active','2026-09-12 08:19:12'),(4,'Glactic','glactic.ideas@gmail.com','87090561833','$2b$12$/ILuaUkbVP/Y9HeYZMOEA.nlR0XjYo5Th5rjT/0SgoInzKHk/fLIe','active','2026-09-12 08:49:07'),(5,'Manju velayudam','manjuvelayudam@gmail.com','9150384761','$2b$12$uxDpdPh.VsFJNCCR6jfiB.S1JbivWpsHI8f8C7L5XVnKWj.NHL.JK','active','2026-09-12 09:02:32');
/*!40000 ALTER TABLE `buyers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity_delivered` decimal(12,2) NOT NULL,
  `unit_price_charged` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_item_invoice` (`invoice_id`),
  CONSTRAINT `fk_invoice_item_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_items`
--

LOCK TABLES `invoice_items` WRITE;
/*!40000 ALTER TABLE `invoice_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(100) NOT NULL,
  `po_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `raw_text` text NOT NULL,
  `status` enum('submitted','audited','disputed') NOT NULL DEFAULT 'submitted',
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_po` (`po_id`),
  KEY `idx_invoice_vendor` (`vendor_id`),
  KEY `idx_invoice_status` (`status`),
  CONSTRAINT `fk_invoice_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `fk_invoice_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) NOT NULL,
  `buyer_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `expected_quantity` decimal(12,2) NOT NULL,
  `agreed_unit_price` decimal(12,2) NOT NULL,
  `status` enum('pending','accepted','rejected','completed','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`),
  KEY `idx_po_buyer` (`buyer_id`),
  KEY `idx_po_vendor` (`vendor_id`),
  KEY `idx_po_status` (`status`),
  CONSTRAINT `fk_po_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `buyers` (`id`),
  CONSTRAINT `fk_po_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
INSERT INTO `purchase_orders` VALUES (1,'PO-20260912-0001',3,2,'Wireless Mouse Pro',50.00,450.00,'accepted','2026-09-12 08:30:14','2026-09-12 08:32:53'),(2,'PO-20260912-0002',4,2,'MICE',100.00,500.00,'pending','2026-09-12 09:11:43','2026-09-12 09:11:43'),(3,'PO-20260912-0003',4,4,'KEYBOARD',1000.00,1000.00,'accepted','2026-09-12 09:15:43','2026-09-12 09:32:10'),(4,'PO-20260912-0004',4,4,'eafe',520.00,520.00,'pending','2026-09-12 09:42:42','2026-09-12 09:42:42');
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_name` varchar(150) NOT NULL,
  `owner_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `address` text,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('pending','approved','blocked') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (2,'Test Supplies Pvt Ltd','Test Vendor','vendor-test-2026@example.com','9876543211','Chennai, Tamil Nadu','$2b$12$w6X91mWzwD99gyllAyWcqe/ds9WyiaprLagAL1HpGjQa3LsJ3Q31u','approved','2026-09-12 08:20:26'),(3,'service','manju','manjuvelayudam@gmail.com','9150384761','jbhjhuv njubkjbvigbvkjsd','$2b$12$bL.9QvWCAL4.SJaebHFzL.58e9YoMorY64TfJqX5aP5q/Coe4vFf.','pending','2026-09-12 09:03:20'),(4,'ABC Electronics Pvt Ltd','Arun Kumar','vendor-abc-2026@example.com','9876543212','Chennai, Tamil Nadu','$2b$12$c1nqG2cI/x5hBXnyqnvq.O1ruG0TR.FTInKBzsgmugJUSW0JhZKNq','approved','2026-09-12 09:14:57');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-12  9:51:31
