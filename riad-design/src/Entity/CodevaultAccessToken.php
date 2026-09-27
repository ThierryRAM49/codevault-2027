<?php

namespace App\Entity;

use App\Repository\CodevaultAccessTokenRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CodevaultAccessTokenRepository::class)]
#[ORM\Table(name: 'codevault_access_token')]
class CodevaultAccessToken
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private string $email;

    #[ORM\Column(length: 64, unique: true)]
    private string $token;

    #[ORM\Column(length: 64, unique: true)]
    private string $approvalToken;

    // This row's own shareable referral code — every approved/used visitor
    // can hand theirs out to invite others (see referredByCode below).
    #[ORM\Column(length: 16, unique: true)]
    private string $referralCode;

    // The referral code (if any) present in ?ref= when this request came
    // in — i.e. who invited this visitor, not this visitor's own code.
    #[ORM\Column(length: 16, nullable: true)]
    private ?string $referredByCode = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    // Null until the site owner approves the request — the visitor's magic
    // link isn't even emailed before that, so its clock only starts ticking
    // once someone could plausibly click it.
    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $expiresAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $approvedAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $usedAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $rejectedAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $revokedAt = null;

    public function __construct(string $email, string $token, string $approvalToken, string $referralCode)
    {
        $this->email = $email;
        $this->token = $token;
        $this->approvalToken = $approvalToken;
        $this->referralCode = $referralCode;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getToken(): string
    {
        return $this->token;
    }

    public function getApprovalToken(): string
    {
        return $this->approvalToken;
    }

    public function getReferralCode(): string
    {
        return $this->referralCode;
    }

    public function getReferredByCode(): ?string
    {
        return $this->referredByCode;
    }

    public function setReferredByCode(?string $referredByCode): void
    {
        $this->referredByCode = $referredByCode;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getApprovedAt(): ?\DateTimeImmutable
    {
        return $this->approvedAt;
    }

    public function getUsedAt(): ?\DateTimeImmutable
    {
        return $this->usedAt;
    }

    public function isApproved(): bool
    {
        return $this->approvedAt !== null;
    }

    public function approve(\DateTimeImmutable $expiresAt): void
    {
        $this->approvedAt = new \DateTimeImmutable();
        $this->expiresAt = $expiresAt;
    }

    public function isExpired(): bool
    {
        return $this->expiresAt === null || $this->expiresAt < new \DateTimeImmutable();
    }

    public function isUsed(): bool
    {
        return $this->usedAt !== null;
    }

    public function markUsed(): void
    {
        $this->usedAt = new \DateTimeImmutable();
    }

    public function isRejected(): bool
    {
        return $this->rejectedAt !== null;
    }

    public function reject(): void
    {
        $this->rejectedAt = new \DateTimeImmutable();
    }

    public function isRevoked(): bool
    {
        return $this->revokedAt !== null;
    }

    public function revoke(): void
    {
        $this->revokedAt = new \DateTimeImmutable();
    }

    // For the admin dashboard's status column.
    public function getStatus(): string
    {
        if ($this->isRejected()) {
            return 'rejected';
        }

        if ($this->isRevoked()) {
            return 'revoked';
        }

        if ($this->isUsed()) {
            return 'used';
        }

        if ($this->isApproved()) {
            return $this->isExpired() ? 'expired' : 'approved';
        }

        return 'pending';
    }
}
