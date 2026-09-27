<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260827140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add referral_code (own shareable code, unique) and referred_by_code (who invited this visitor) for the referral feature.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE codevault_access_token ADD referral_code VARCHAR(16) DEFAULT NULL, ADD referred_by_code VARCHAR(16) DEFAULT NULL');
        // Backfill existing test rows with a unique value before the NOT NULL constraint lands, instead of requiring the table to be emptied first.
        $this->addSql('UPDATE codevault_access_token SET referral_code = SUBSTRING(SHA2(CONCAT(id, RAND(), NOW(6)), 256), 1, 16) WHERE referral_code IS NULL');
        $this->addSql('ALTER TABLE codevault_access_token MODIFY referral_code VARCHAR(16) NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_49BEB5F44B60CF77 ON codevault_access_token (referral_code)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_49BEB5F44B60CF77 ON codevault_access_token');
        $this->addSql('ALTER TABLE codevault_access_token DROP referral_code, DROP referred_by_code');
    }
}
