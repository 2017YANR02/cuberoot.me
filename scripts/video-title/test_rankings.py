"""测试 wca_rankings 模块"""
import logging
from wca_rankings import RankingCache

logging.basicConfig(level=logging.INFO)

# 初始化缓存
cache = RankingCache()

print("Initializing rankings cache (may take a while)...")
cache.update_all()

if not cache.is_available():
    print("Failed to initialize cache")
else:
    print("Fetching 333 single top 100...")
    data = cache._fetch_top100("333", "single")
    if data:
        print(f"Top 100 threshold: {data['100th']}")
        print(f"First rank: {data['ranks'][0]}")
        print(f"Last rank: {data['ranks'][-1]}")
    else:
        print("Failed to fetch 333 single")

    # 测试查询
    # 假设 WR 是 3.13 (313)
    rank = cache.get_world_rank("333", "single", 313)
    print(f"Result 3.13 rank: {rank}")

    # 假设 WR 是 20.00 (2000) - 应该 > 100
    rank = cache.get_world_rank("333", "single", 2000)
    print(f"Result 20.00 rank: {rank}")

