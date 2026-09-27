<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260827095106 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add approval_token/approved_at for the owner-approval gate; expires_at only gets set once approved.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE codevault_access_token ADD approval_token VARCHAR(64) DEFAULT NULL, ADD approved_at DATETIME DEFAULT NULL, CHANGE expires_at expires_at DATETIME DEFAULT NULL');
        // Backfill existing test rows with a unique value before the NOT NULL constraint lands, instead of requiring the table to be emptied first.
        $this->addSql('UPDATE codevault_access_token SET approval_token = SHA2(CONCAT(id, RAND(), NOW(6)), 256) WHERE approval_token IS NULL');
        $this->addSql('ALTER TABLE codevault_access_token MODIFY approval_token VARCHAR(64) NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_49BEB5F46F568EC8 ON codevault_access_token (approval_token)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_49BEB5F46F568EC8 ON codevault_access_token');
        $this->addSql('ALTER TABLE codevault_access_token DROP approval_token, DROP approved_at, CHANGE expires_at expires_at DATETIME NOT NULL');
    }
}
