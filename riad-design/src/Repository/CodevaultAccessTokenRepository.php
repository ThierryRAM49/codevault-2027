<?php

namespace App\Repository;

use App\Entity\CodevaultAccessToken;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CodevaultAccessToken>
 */
class CodevaultAccessTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CodevaultAccessToken::class);
    }

    public function findByToken(string $token): ?CodevaultAccessToken
    {
        return $this->findOneBy(['token' => $token]);
    }

    public function findByApprovalToken(string $approvalToken): ?CodevaultAccessToken
    {
        return $this->findOneBy(['approvalToken' => $approvalToken]);
    }

    public function findByReferralCode(string $referralCode): ?CodevaultAccessToken
    {
        return $this->findOneBy(['referralCode' => $referralCode]);
    }

    /** @return CodevaultAccessToken[] */
    public function findAllNewestFirst(): array
    {
        return $this->findBy([], ['createdAt' => 'DESC']);
    }

    // Real, honest count for the landing page's social-proof line — people
    // who actually completed the login flow, not just requested access.
    public function countUsed(): int
    {
        return (int) $this->createQueryBuilder('t')
            ->select('COUNT(t.id)')
            ->where('t.usedAt IS NOT NULL')
            ->getQuery()
            ->getSingleScalarResult();
    }
}
