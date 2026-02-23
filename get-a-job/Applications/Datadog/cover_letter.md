# Cover Letter - Datadog | Software Engineer - Backend

Dear Hiring Team,

I've built and operated real-time data pipelines processing high-throughput events using Go, Kafka, Redis, and Clickhouse -- the same building blocks behind the core engineering challenge Datadog solves. Ingesting, processing, and surfacing massive volumes of telemetry data with low latency is what I want to do at Datadog's scale.

At Front.Page (YC S'21), I designed a real-time stock data pipeline using Go, Kafka, and ProtoBuffers that supported the platform's growth from 15k to 200k daily active users in 14 weeks. This system had to handle bursty, high-throughput data with strict latency requirements -- very similar to challenges of ingesting metrics, logs, and traces at scale. I also built an analytics pipeline using Clickhouse as the data aggregator with Rudderstack, giving me direct experience with columnar data stores designed for the kind of high-cardinality, time-series workloads that are central to observability platforms.

Three specific areas where my experience aligns with Datadog's engineering needs:

**High-throughput distributed systems.** Beyond the Kafka pipeline, I implemented queue-based batching to reduce database load, built Redis-backed systems with O(1) retrieval for real-time counters, and designed a real-time data delivery system with Socket.io supporting multiple subscription management modes (room-based, in-memory, Redis-backed). These are the same patterns used in distributed observability infrastructure.

**Go-first backend development.** Go has been my primary backend language across both VaultWealth and Front.Page. At VaultWealth, I built a Financial Planning Service in Go and migrated workflows to Temporal, eliminating 90% of unexpected failures. I am comfortable writing performant, concurrent Go in production environments.

**Performance obsession.** I reduced HTML build and load times from 600ms to 60ms through Redis caching, cut database calls by 92% through session optimization, and reduced notification delivery time by 90% through FCM topic-based architecture. I bring a habit of measuring, profiling and improving system performance -- which feels right at home at a company that builds performance monitoring tools.

I am based in India and open to relocating to New York or Boston for this role.

Happy to chat more about any of this.

Thanks,
Sarthak
