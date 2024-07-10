---
title: Spring batch 성능 개선 part2 - ZeroOffsetItemReader 본격 개발
date: 2024-07-05
update: 2024-07-05
tags: 
  - spring batch
  - ZeroOffsetItemReader
series: "Spring Batch 성능 개선"
---

![spring-batch.webp](../spring-batch-customReader-1/spring-batch.webp)

<a href="https://goodchoi.site/spring-batch-customReader-1/" target="_blank">지난 글</a>에서 페이징 방식을 채택하는
기존의 `itemReader`가 가지는 태생적 문제점을 살펴봤다. 이제 남은 것은 문제의 솔루션인 `ZeroOffset` 페이징 방식으로 동작하는 
`itemReader`를 개발하는 것이다. 사실 `개발`이라고 하는 거창한 단어가 무색한 것이, 기존에 이미 검증된 페이징 `itemReader`가 존재하므로
이들 중 하나를 골라 새로운 클래스를 만들어 복붙한 후 수정해 나가는 방향으로 작업을 했다. 

## 0. 기존 페이징 item Reader의 종류
일반적으로 스프링 배치에서 제공하는 페이징 기반의 `item reader`는 다음과 같다.

- JdbcPagingItemReader
- HibernatePagingItemReader
- JpaPagingItemReader
- RepositoryItemReader
- MongoPagingItemReader

: 
등등

이들 중 `jpa` 환경에서 가장 많이 사용되는 것은 `JpaPagingItemReader` 와 `RepositoryItemReader`인 것 같다.


| 종류                  | 사용법                                             | 특징                                    | 
|---------------------|-------------------------------------------------|---------------------------------------|
| **JpaPagingItemReader** | reader 생성시 실행할 `JPQL` 문자열을 파라미터로 등록             | 트랜잭션을 별도로관리                           |
| **RepositoryItemReader** | 대상 엔티티의 `repository`(스프링 데이터 jpa)와 실행할 메서드의 이름을 파라미터로 등록 | 스프링 데이터 jpa기능 사용가능, 트랜잭션을 청크 트랜잭션에 위임 |

그렇다면 jpa를 사용할때 `ZeroOffset`으로 동작하도록 개선하려면 어떤 것을 선택하는 것이 유리할까?
기본적으로 `ZeroOffset`방식으로 동작하려면 사용자가 실행하고자하는 `JPQL`을 동적으로 수정하는 작업이 수반되기 때문에
`JPQL` 문자열을 단독으로 파라미터로 넘겨줘야하는 `JpaPagingItemReader`를 기반으로 개발하는 것이 유리하다고 판단된다.

## 1. JpaPagingItemReader 동작 방식 분석
`JpaPagingItemReader`는 `doPagePage`에서 `entityManager`를 통해 쿼리를 실행시키는 로직을 포함한다.
전체 코드는 다음과 같다.

```java
public class JpaPagingItemReader<T> extends AbstractPagingItemReader<T> {
    //생략
    protected void doReadPage() {
        EntityTransaction tx = null;
        if (this.transacted) {
            tx = this.entityManager.getTransaction();
            tx.begin();
            this.entityManager.flush();
            this.entityManager.clear();
        }

        Query query = this.createQuery().setFirstResult(this.getPage() * this.getPageSize()).setMaxResults(this.getPageSize());
        if (this.parameterValues != null) {
            Iterator var3 = this.parameterValues.entrySet().iterator();

            while(var3.hasNext()) {
                Map.Entry<String, Object> me = (Map.Entry)var3.next();
                query.setParameter((String)me.getKey(), me.getValue());
            }
        }

        if (this.results == null) {
            this.results = new CopyOnWriteArrayList();
        } else {
            this.results.clear();
        }

        if (!this.transacted) {
            List<T> queryResult = query.getResultList();
            Iterator var7 = queryResult.iterator();

            while(var7.hasNext()) {
                T entity = var7.next();
                this.entityManager.detach(entity);
                this.results.add(entity);
            }
        } else {
            this.results.addAll(query.getResultList());
            tx.commit();
        }
    }
}
```

단계별로 나누면 다음과 같다.

    1.트랜잭션 생성 -> 2.Query생성 -> 3. 반환 리스트 객체 생성 -> 4. query 수행 


<details>
<summary>📍각 단계 자세히 보기 </summary>


#### 1. 트랜잭션 생성
```java
EntityTransaction tx = null;
if (this.transacted) {
    tx = this.entityManager.getTransaction();
    tx.begin();
    this.entityManager.flush();
    this.entityManager.clear();
}
```
기본적으로 `jpaPagingItemReader`의 `transacted`설정값은 `true`이다. 즉 `reader` 내부에서 새로운 트랜잭션을 생성하고 관리한다.
이 부분은 <a href="https://goodchoi.site/spring-batch-JpaPagingItemReader-Cautions/" target="_blank">해당 주제를 다른 글</a>에서 다루었다.

#### 2.Query생성
```java
Query query = this.createQuery().setFirstResult(this.getPage() * this.getPageSize()).setMaxResults(this.getPageSize());
if (this.parameterValues != null) {
    Iterator var3 = this.parameterValues.entrySet().iterator();

    while(var3.hasNext()) {
        Map.Entry<String, Object> me = (Map.Entry)var3.next();
        query.setParameter((String)me.getKey(), me.getValue());
    }
}

private Query createQuery() {
	return this.queryProvider == null ? this.entityManager.createQuery(this.queryString) : this.queryProvider.createQuery();
}
```
`createQuery()`메서드를 호출하여 사용자가 입력한 `JPQL`을 기반으로 `Query`를 생성한다.
이때 사용자가 입력한 파라미터를 `Query`에 set하고 있다.

#### 3. 반환 리스트 객체 초기화
```java
if (this.results == null) {
    this.results = new CopyOnWriteArrayList();
} else {
    this.results.clear();
}
```
첫 시도일시 `new CopyOnWriteArrayList();`로 결과를 담을 빈 리스트를 생성한다. 이후에는 `clear()`하며 재사용한다.

#### 4. query 수행
```java
if (!this.transacted) {
    List<T> queryResult = query.getResultList();
    Iterator var7 = queryResult.iterator();
    while(var7.hasNext()) {
        T entity = var7.next();
        this.entityManager.detach(entity);
        this.results.add(entity);
    }
} else {
    this.results.addAll(query.getResultList());
    tx.commit();
}
```
`transacted` 옵션이 `false`라면 `reader`내부에서 트랜잭션을 사용하지 않겠다는 뜻이며 읽은 모든 엔티티를 준영속화 한다.
결과적으로 `results`에 읽어들인 모든 데이터들이 담기게 된다.

</details>

## 2. ZeroOffset 적용
`JpaPagingItemReader`의 동작원리를 분석했으니 이제 적용을 어떻게 할 것인지 단계별로 설계해보자.
기본 전제는 `JpaPagingItemReader`와 최대한 비슷한 환경으로 사용하게 만드는 것이다.

최종적으로 `ZeroOffsetItemReader`에서 추가 및 수정될 로직은 다음과 같다.
```
- 빈 생성시 JPQL 문자열을 동적으로 수정 -> 최초 1회 수행
- 빈 생성시 엔티티 pk 필드 정보 저장 -> 최초 1회 수행
- Query생성시 offset을 0으로 고정하고 마지막 pk값을 파라미터로 전달
- 페이지 read 후 가장 마지막 PK값을 내부 필드로 저장
```

### 2-1  빈 생성시 JPQL 문자열을 동적으로 수정 (문자열 수정)
만약 사용자가 다음과 같은 `Jpql`을 실행하고자 한다.
```sql
select u
from User u
where u.status=:stauts
```

이때 5번째 페이지라고 가정하면 `JpaPagingItemReader`에 의해 최종적으로 질의하는 쿼리는 다음과같다.
(`SQL` - Mysql 기준)
```sql
select *
from users
where status='GOOD'
limit 500,100
```

하지만 `ZeroOffsetItemReader`가 최종적으로 질의해야하는 쿼리는 다음과 같아야한다.
```sql
select *
from users
where status='GOOD' and user_id > 500 
limit 0,100
```

결국 위와 같이 동작하기위해 사용자가 파라미터로 넘긴 `jpql` 문자열을 다음과 같은 문자열로 동적으로 수정해야한다.
```sql
select u
from User u
where u.status=:stauts [and u.id>:lastId]
```
즉 where절이 없다면 where절을 만들어줘야하고, 있다면 마지막 끝에 and 조건을 추가해야한다.
말은 쉽지만 구현은 좀 까다로웠는데, `where`절 이후에 올 수 있는 `group by`나 `order by` 같은 절이 있는지 여부를 신경 써야하기 때문이였다.

<details>
<summary> 📍해당 메서드 로직 </summary>

```java
private void modifyQueryString() {
    StringBuilder modifiedQueryStringBuilder = new StringBuilder();

    String pkAlias = extractAlias(this.queryString) + "." + pkField.getName();
    String newClause = pkAlias + " >:" + PK_PARAMETER_NAME;

    String lowerJpql = this.queryString.toLowerCase();
    int whereIndex = lowerJpql.indexOf(" where ");
    int orderByIndex = lowerJpql.indexOf(" order by ");
    int groupByIndex = lowerJpql.indexOf(" group by ");
    int endIndex = lowerJpql.length();

    if (groupByIndex != -1 && orderByIndex == -1) {
        endIndex = groupByIndex;
    } else if (orderByIndex != -1) {
        throw new IllegalArgumentException("order by는 지원되지 않습니다.");
    }

    if (whereIndex == -1) {
        // `WHERE` 절이 없는 경우
        String fromClause = this.queryString.substring(0, endIndex);
        String remainingClause = this.queryString.substring(endIndex);
        modifiedQueryStringBuilder.append(fromClause)
            .append(" WHERE ")
            .append(newClause)
            .append(remainingClause);
    } else {
        // `WHERE` 절이 있는 경우
        String beforeWhere = this.queryString.substring(0, whereIndex + 7);
        String afterWhere = this.queryString.substring(whereIndex + 7, endIndex);
        String remainingClause = this.queryString.substring(endIndex);

        modifiedQueryStringBuilder.append(beforeWhere)
            .append(afterWhere)
            .append(" AND ")
            .append(newClause)
            .append(remainingClause);
    }

    modifiedQueryStringBuilder.append(" order by")
        .append(pkAlias);

    this.modifiedQueryString = modifiedQueryStringBuilder.toString();
}
```


> 참고로 현재는 `pk`를 기준으로 정렬하는 경우만 고려 하기로 했다
> 향후에 필요에 따라 특정 인덱스를 기준으로 정렬하는 경우도 고려해봐야겠다.

</details>

### 2-2 빈 생성시 엔티티 pk 필드 정보 저장(java reflection)
기본적으로 `jpql`의 대상 엔티티의 pk 값을 인자로 넘겨주기 위해선 
`u.id`와 같은 조합이 필요하다. 이것은 `[엔티티 alias].[엔티티의 pk 필드명]` 과 같은 형식이다.
`alias`는 명시된 `jpql` 문자열에서 찾아낼 수 있지만 `엔티티의 pk 필드명`은 어떻게 알아 낼 것인가? 여기서 문제점에 봉착 했다.

기본적으로 `JpaPagingItemReader`를 생성할 때 대상 엔티티의 정보를 `제네릭`으로 지정하여 생성한다.
```java
return new JpaPagingItemReaderBuilder<PartyCapsule>()
    ..
    .build();
```

단순히 엔티티에 대한 정보를 제네릭에 의존하고 있다. 그렇다면 제네릭으로 지정된 클래스에대한 정보를 런타인 시점에 확보할 수 있는가?
결론은 `불가능`하다. 제네릭의 `Type Erasure`동작 방식에 의해 `<T>`는 `Object`로 치환되기 때문이다. 즉 제네릭 클래스의 정보를 런타임 시점에서 소실한다.
따라서 여기서 절충안으로 다음처럼 요구하게 했다.

```java
return new ZeroOffsetJpaPagingItemReaderBuilder<PartyCapsule>()
        .entityClass(PartyCapsule.class)
        ..  
        .build();
```
바로 제네릭외에 엔티티의 클래스 정보를 파라미터로 넘겨 받는 것이다.
이렇게하면 런타임 시점에서 소실하지 않게 되며 다음과 같이 `엔티티 pk 필드명`을 자바 `reflect` api를 사용하여 알아낼 수 있다.

```java
for (Field field : entityClass.getDeclaredFields()) {
    Id myAnnotation = field.getAnnotation(Id.class);
    if (myAnnotation != null) {
        this.pkField = field;
        this.pkField.setAccessible(true);
        break;
    }
}
```

엔티티의 `@Id`어노테이션이 붙은 필드를 찾고 `PK`필드에 대한 정보를 최종적으로 `Field` 타입으로 저장한다.
이제 `Field`의 `getName()`를 호출하여 필드명을 알아 낼 수 있게 되었다.

### 2-2 Query생성 및 호출
우선 기존 `JpaPagingItemReader`와 달리 시작행을 항상 0으로 고정하여 `Query`를 먼저 생성한다.
```java
Query query = this.entityManager.createQuery(this.modifiedQueryString)
			.setFirstResult(0)
			.setMaxResults(this.getPageSize());
```

이후 기존등록된 파라미터를 설정한 후 마지막에 pk 값을 인자로 넘겨준다.
```java
query.setParameter(PK_PARAMETER_NAME, lastPkId);
```

### 2-3 페이지 read 후 가장 마지막 PK값을 내부 필드로 저장

읽어들인 페이지는 pk값으로 데이터를 오름차순으로 조회하였으므로 마지막 인덱스의 pk값을 내부 필드에 저장해야한다.
```java
private Object extractLastPkIdFromResult() {
    T lastRow = this.results.get(this.results.size() - 1);
    try {
        return pkField.get(lastRow);
    } catch (Exception e) {
        log.error("id capture error", e);
    }
    return null;
}
```

위에서 pk 필드에대한 정보를 `Field` 타입으로 변수에 저장해 두었다. 따라서 실제 값을 확보할 때도 이 `Field`를 이용하여
추출해낸다. 최종적으로 추출한 값을 내부 필드에 갱신하여 다음 페이지 read시 인자값으로 사용한다.


## 3. 트랜잭션 구조 변경
<a href="https://goodchoi.site/spring-batch-JpaPagingItemReader-Cautions/" target="_blank">이전에 작성한 글</a>에서 `JpaPagingItemReader`가 
청크에게 트랜잭션을 맡기는 것이 아닌 내부에서 트랜잭션을 생성하는것에 관한 글을 작성한 적이있다. 사실 이것은 나름 대로 그럴 만한 이유가 있겠지만,
나는 이번에 이 트랜잭션을 청크에게 맡기는 방식으로 변경 해보기로 했다. 사이드 이펙트가 있을지는 모르는 일이지만 아직은 파악된 바가 없다.

### 3-1 트랜잭션 코드 제거.
```java
EntityTransaction tx = null;
if (this.transacted) {
    tx = this.entityManager.getTransaction();
    tx.begin();
    this.entityManager.flush();
    this.entityManager.clear();
}
```
기존에 트랜잭션을 생성하는 코드를 제거하고,
```java
@Transactional
protected void doReadPage() {
}
```
스프링의 `@Transactional`을 사용했다
이것은 나름대로 이유가 있었는데, 바로 엔티티매니저 생성 방식을 바꾸기 위해서이다.
기존에는 엔티티 매니저를 `entityManagerFactory.createEntityManager(this.jpaPropertyMap);`를 사용하여 엔티티 매니저 인스턴스를 생성했다면,
이 `reader`에서는 청크 트랜잭션의 경계 내부에 참여하고있는 엔티티매니저를 사용하여 영속성 컨텍스트를 공유하고 싶었다. 읽어 들인 엔티티의 영속상태를 청크 단위 트랜잭션에서 계속 유지를 하련는
목적이였다.

따라서 현재는 엔티티매니저를 다음과 같이 내부 필드로 선언한여 의존성 주입받았다.
```java
@Autowired
private EntityManager entityManager;
```

위와 같이 조치하여 테스트를 해봤을때, <a href="https://goodchoi.site/spring-batch-JpaPagingItemReader-Cautions/" target="_blank">이전글에서</a> 나타났던
현상들은 발생하지않았고, `dirty checking` 또한 완벽하게 작동하는 것을 확인했다.

## 4. 정리
모든 코드는 <a href="https://goodchoi.site/spring-batch-customReader-1/" target="_blank">ZeroOffsetJpaPagingItemReader</a>에서 확인할 수 있다.
기존 코드를 수정하는 방식으로 작성 되었기 때문에 미처 생각하지 못한 사이드 이펙트와 내가 찾지 못한 예외가 굉장히 많을 것으로 예상된다.
하지만 나는 `ZeroOffset`으로 동작했을때 기존 방식과 어느정도 성능차이가 발생하는 지 비교해보고 싶었고, 해당 코드를 작성하면서 자바 `reflection` api,
스프링 배치내부에서 트랜잭션 관리 등을 더 깊게 이해하는 계기가 되었다. 

다음글에서는 내가 만든 `reader`의 성능 테스트 결과를 작성해 볼 예정이다.

















